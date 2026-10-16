import { TestBed, fakeAsync, tick, discardPeriodicTasks } from '@angular/core/testing';
import {Router} from '@angular/router';
import {Subject, Subscription} from 'rxjs';

import { GameService } from './game.service';
import {WebSocketService} from './web-socket.service';
import {EGameStatesMaster} from '../master/enums/EGameStatesMaster';
import {EPacketTypes, IGamePacket, IRegisterMasterPacket, IWebSocketMessage, PacketHelper} from '../../../../shared/shared';
import {pathsMaster} from '../master/paths-master';

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
