import {Logger} from '../../helper/logger';
import {
  EPacketTypes,
  IAnswerSetStatePacket,
  IDataForScreenPacket,
  IEndGamePacket,
  IGamePacket,
  IKeypressOnScreenPacket,
  IMarkTeamPacket,
  INewMasterAccepted,
  IPresetupAvailableInfoPacket,
  IResetServerPacket,
  IResponsePacket,
  ISetBuzzerLockPacket,
  ISetQuestionPacket,
  ITeamSetPointsPacket,
  IUpdateMediaStatePacket,
  PacketHelper
} from '../../../../../shared/shared';
import {WebSocketService} from '../web-socket.service';

export abstract class ClientGameBase {
  constructor(
    protected webSocketService: WebSocketService
  ) {
  }

  protected onMessage(message: IGamePacket): void {
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
      case EPacketTypes.NEW_MASTER_ACCEPTED:
        this.handleNewMasterAcceptedPacket(message as INewMasterAccepted);
        break;
      case EPacketTypes.DATA_FOR_SCREEN:
        this.handleDataForScreenPacket(message as IDataForScreenPacket);
        break;
      case EPacketTypes.TEAM_SET_POINTS:
        this.handleTeamSetPointsPacket(message as ITeamSetPointsPacket);
        break;
      case EPacketTypes.ANSWER_SET_STATE:
        this.handleAnswerSetStatePacket(message as IAnswerSetStatePacket);
        break;
      case EPacketTypes.SET_QUESTION:
        this.handleSetQuestionPacket(message as ISetQuestionPacket);
        break;
      case EPacketTypes.END_GAME:
        this.handleEndGamePacket(message as IEndGamePacket);
        break;
      case EPacketTypes.MARK_TEAM:
        this.handleMarkTeamPacket(message as IMarkTeamPacket);
        break;
      case EPacketTypes.SET_BUZZER_LOCK:
        this.handleSetBuzzerLockPacket(message as ISetBuzzerLockPacket);
        break;
      case EPacketTypes.RESET_SERVER:
        this.handleResetServerPacket(message as IResetServerPacket);
        break;
      case EPacketTypes.UPDATE_MEDIA_STATE:
        this.handleMediaStateUpdate(message as IUpdateMediaStatePacket);
        break;
      default:
        break;
    }
  }

  protected handleResponsePackets(packet: IResponsePacket): void {
    // override
  }

  protected handlePresetupAvailableInfo(packet: IPresetupAvailableInfoPacket): void {
    // override
  }

  protected handleNewMasterAcceptedPacket(packet: INewMasterAccepted): void {
    // override
  }

  protected handleDataForScreenPacket(packet: IDataForScreenPacket): void {
    // override
  }

  protected handleTeamSetPointsPacket(packet: ITeamSetPointsPacket): void {
    // override
  }

  protected handleAnswerSetStatePacket(packet: IAnswerSetStatePacket): void {
    // override
  }

  protected handleSetQuestionPacket(packet: ISetQuestionPacket): void {
    // override
  }

  protected handleEndGamePacket(packet: IEndGamePacket): void {
    // override
  }

  protected handleMarkTeamPacket(packet: IMarkTeamPacket): void {
    // override
  }

  protected handleSetBuzzerLockPacket(packet: ISetBuzzerLockPacket): void {
    // override
  }

  protected handleResetServerPacket(packet: IResetServerPacket): void {
    // override
  }

  protected handleMediaStateUpdate(packet: IUpdateMediaStatePacket): void {
    // override
  }

  public sendKeypress(keyCode: string): void {
    this.webSocketService.send<IKeypressOnScreenPacket>(PacketHelper.makeKeypressOnScreenPacket(keyCode));
  }
}
