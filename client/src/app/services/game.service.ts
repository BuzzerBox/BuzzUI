import {Injectable, OnDestroy} from '@angular/core';
import {WebSocketService} from './web-socket.service';
import {
  EPacketTypes,
  IGamePacket,
  IPresetupAvailableInfoPacket,
  IRegisterMasterPacket,
  IResponsePacket,
  ITeam
} from '../../../../shared/objects/shared';
import {Subscription} from 'rxjs';
import {Router} from '@angular/router';
import {EGameStatesMaster} from '../master/enums/EGameStatesMaster';
import {Logger} from '../helper/logger';
import {pathsMaster} from '../master/paths-master';

@Injectable({
  providedIn: 'root'
})
export class GameService implements OnDestroy {
  // private webSocketService: WebSocketService;
  private webSocketListenSubscription: Subscription;
  private currentGameState: EGameStatesMaster;
  private previousGameState: EGameStatesMaster;
  private teams: ITeam[];

  constructor(private webSocketService: WebSocketService, private router: Router) {
    // this.webSocketService = webSocketService;
    this.teams = [];
    this.setNewGameState(EGameStatesMaster.STARTING);
    this.webSocketListenSubscription = webSocketService.listen(this.onMessage.bind(this));
    this.registerMaster();
  }

  private registerMaster(): void {
    this.webSocketService.send<IRegisterMasterPacket>({packetType: EPacketTypes.REGISTER_MASTER});
  }

  private onMessage(message: IGamePacket): void {
    Logger.log('Got new websocket message', message);
    if (message == null) {
      // ignore
      return;
    }
    switch (message.packetType) {
      case EPacketTypes.RESPONSE_PACKET:
        this.handleResponsePackets(message as IResponsePacket);
        break;
      case EPacketTypes.PRESETUP_AVAILABLE_INFO:
        this.handlePresetupAvailableInfo(message as IPresetupAvailableInfoPacket);
        break;
      default:
        break;
    }
  }

  ngOnDestroy(): void {
    if (this.webSocketListenSubscription != null) {
      this.webSocketListenSubscription.unsubscribe();
    }
  }

  private handlePresetupAvailableInfo(packet: IPresetupAvailableInfoPacket): void {
    // only accept this packet when the master was just accepted, hence npo game is really started yet
    if (this.currentGameState === EGameStatesMaster.MASTER_ACCEPTED) {
      this.setNewGameState(EGameStatesMaster.RECEIVED_PRESETUP_DATA);
      // this.router.navigate([pathsMaster.setup]);
      this.redirect(pathsMaster.setup);
    }
  }

  private setNewGameState(newState: EGameStatesMaster): void {
    Logger.log(`Setting new game state: ${newState}`);
    this.previousGameState = this.currentGameState;
    this.currentGameState = newState;
  }

  private handleResponsePackets(packet: IResponsePacket): void {
    if (packet.responseTo === EPacketTypes.REGISTER_MASTER && this.currentGameState === EGameStatesMaster.STARTING) {
      console.dir("huso");
      console.dir(packet);
      console.dir(this.currentGameState);
      if (packet.wasSuccessful) {
        this.setNewGameState(EGameStatesMaster.MASTER_ACCEPTED);
      } else {
        this.setNewGameState(EGameStatesMaster.END);
        this.redirect(pathsMaster.masterAlreadyRegistered);
      }
    }
  }

  public getGameState(): EGameStatesMaster {
    return this.currentGameState;
  }

  private redirect(target: string): void {
    this.router.navigate([target]);
  }
}
