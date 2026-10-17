import { TestBed, fakeAsync, tick, discardPeriodicTasks } from '@angular/core/testing';
import {Router} from '@angular/router';
import {Subject, Subscription} from 'rxjs';

import { GameService } from './game.service';
import {WebSocketService} from './web-socket.service';
import {EGameStatesMaster} from '../master/enums/EGameStatesMaster';
import {EPacketTypes, IGamePacket, IRegisterMasterPacket, IWebSocketMessage, PacketHelper} from '../../../../shared/shared';
import {baseUrlMaster, pathsMaster} from '../master/paths-master';

describe('GameService', () => {
  let service: GameService;
  let sent: IWebSocketMessage[];
  let receive: (packet: IGamePacket) => void;
  let reconnects: Subject<void>;
  let router: jasmine.SpyObj<Router>;

  beforeEach(() => {
    sent = [];
    reconnects = new Subject<void>();
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    router.navigate.and.resolveTo(true);
    const webSocket = {
      send: (message: IWebSocketMessage) => { sent.push(message); return Promise.resolve(); },
      listen: (callback: (message: IGamePacket) => void) => { receive = callback; return Promise.resolve(new Subscription()); },
      observeReconnects: () => reconnects.asObservable()
    };
    TestBed.configureTestingModule({
      providers: [
        {provide: WebSocketService, useValue: webSocket},
        {provide: Router, useValue: router}
      ]
    });
    service = TestBed.inject(GameService);
  });

  const registrations = () => sent.filter(m => (m as IGamePacket).packetType === EPacketTypes.REGISTER_MASTER) as IRegisterMasterPacket[];

  const refuse = (isGameRunning: boolean) => receive({
    ...PacketHelper.makeResponsePacket(EPacketTypes.REGISTER_MASTER, false),
    isGameRunning
  } as IGamePacket);

  it('shows a refused master the page about the other master', () => {
    service.useAsMaster();
    refuse(true);
    expect(service.getGameState()).toBe(EGameStatesMaster.REJECTED);
    expect(service.getMasterRejection()).toEqual({isGameRunning: true, takenOver: false});
    expect(router.navigate).toHaveBeenCalledWith([pathsMaster.masterAlreadyRegistered]);
  });

  it('lets a refused master try again by itself after the server closed its connection', fakeAsync(() => {
    service.useAsMaster();
    refuse(false);
    reconnects.next();
    expect(registrations().length).toBe(1);
    tick(3000);
    expect(registrations().length).toBe(2);
    expect(registrations()[1].takeOver).toBeUndefined();
    receive(PacketHelper.makeResponsePacket(EPacketTypes.REGISTER_MASTER, true));
    expect(service.getGameState()).toBe(EGameStatesMaster.MASTER_ACCEPTED);
    expect(service.getMasterRejection()).toBeNull();
    discardPeriodicTasks();
  }));

  it('takes over, also when registering again after a reconnect', () => {
    service.useAsMaster();
    refuse(true);
    service.registerAgainAsMaster(true);
    expect(registrations()[1].takeOver).toBeTrue();
    // the request went out while the connection was down: the reconnect sends it again and must take over as well
    reconnects.next();
    expect(registrations()[2].takeOver).toBeTrue();
    receive(PacketHelper.makeResponsePacket(EPacketTypes.REGISTER_MASTER, true));
    service.registerAgainAsMaster();
    expect(registrations().length).toBe(3);
  });

  it('sends the same device ID with every registration', () => {
    service.useAsMaster();
    refuse(false);
    service.registerAgainAsMaster();
    const ids = registrations().map(r => r.masterId);
    expect(ids[0]).toBeTruthy();
    expect(ids[1]).toBe(ids[0]);
    expect(localStorage.getItem('buzzerbox-master-id')).toBe(ids[0]);
  });

  it('stops taking over once it joined the running game', () => {
    service.useAsMaster();
    refuse(true);
    service.registerAgainAsMaster(true);
    // a running game is answered with this packet, not with a response
    receive({packetType: EPacketTypes.NEW_MASTER_ACCEPTED, teams: [], questions: [], currentGameState: null} as IGamePacket);
    expect(service.getGameState()).toBe(EGameStatesMaster.READY_TO_START);
    service.resetServer();
    reconnects.next();
    expect(registrations()[2].takeOver).toBeUndefined();
  });

  const startGamePackets = () => sent.filter(m => (m as IGamePacket).packetType === EPacketTypes.START_GAME);

  it('starts the game right after it was set up, and then shows the play page', () => {
    service.useAsMaster();
    receive(PacketHelper.makeResponsePacket(EPacketTypes.REGISTER_MASTER, true));
    receive({packetType: EPacketTypes.PRESETUP_AVAILABLE_INFO, availableBuzzers: []} as IGamePacket);
    service.setupGame([], []);
    receive(PacketHelper.makeResponsePacket(EPacketTypes.SETUP_GAME, true));
    expect(startGamePackets().length).toBe(1);
    receive(PacketHelper.makeResponsePacket(EPacketTypes.START_GAME, true));
    expect(service.getGameState()).toBe(EGameStatesMaster.PLAYING);
    expect(router.navigate).toHaveBeenCalledWith([baseUrlMaster + pathsMaster.play]);
  });

  it('goes on with the running game right after rejoining it', () => {
    service.useAsMaster();
    receive({packetType: EPacketTypes.NEW_MASTER_ACCEPTED, teams: [], questions: [], currentGameState: null} as IGamePacket);
    expect(startGamePackets().length).toBe(1);
  });

  it('waits longer after every refusal, up to a maximum', fakeAsync(() => {
    service.useAsMaster();
    const waits: number[] = [];
    for (let i = 0; i < 5; i++) {
      refuse(false);
      reconnects.next();
      const before = registrations().length;
      let waited = 0;
      while (registrations().length === before) {
        tick(1000);
        waited += 1000;
      }
      waits.push(waited);
    }
    expect(waits).toEqual([3000, 6000, 12000, 15000, 15000]);
  }));

  it('does not try again by itself while the user decides whether to take over', fakeAsync(() => {
    service.useAsMaster();
    refuse(true);
    reconnects.next();
    service.pauseMasterRetry(true);
    tick(20000);
    expect(registrations().length).toBe(1);
    service.registerAgainAsMaster(true);
    service.pauseMasterRetry(false);
    expect(registrations().length).toBe(2);
    expect(registrations()[1].takeOver).toBeTrue();
    tick(20000);
    expect(registrations().length).toBe(2);
  }));

  it('drops the storage token when it was taken over from', () => {
    service.useAsMaster();
    receive(PacketHelper.makeResponsePacket(EPacketTypes.REGISTER_MASTER, true));
    receive({packetType: EPacketTypes.STORAGE_ACCESS, token: 'secret'} as IGamePacket);
    expect(service.getStorageToken()).toBe('secret');
    receive({packetType: EPacketTypes.MASTER_TAKEN_OVER});
    expect(service.getStorageToken()).toBeNull();
  });

  it('does not try to get back in by itself after it was taken over from', fakeAsync(() => {
    service.useAsMaster();
    receive(PacketHelper.makeResponsePacket(EPacketTypes.REGISTER_MASTER, true));
    receive({packetType: EPacketTypes.MASTER_TAKEN_OVER});
    expect(service.getGameState()).toBe(EGameStatesMaster.REJECTED);
    expect(service.getMasterRejection().takenOver).toBeTrue();
    reconnects.next();
    tick(10000);
    expect(registrations().length).toBe(1);
  }));
});
