import {EAnswerStates, IAnswer, EPacketTypes, IAnswerSetStatePacket, ISetQuestionPacket, IEndGamePacket, IKeypressOnScreenPacket,
IMarkTeamPacket} from '../../../../shared/objects/shared';

export class PacketsHelper {

  private constructor() {
    // suppress instantiation
  }

  public static makeAnswerSetSatePacket(state: EAnswerStates, answer?: IAnswer): IAnswerSetStatePacket {
    return {
      packetType: EPacketTypes.ANSWER_SET_STATE,
      state,
      answer
    };
  }

  public static makeSetQuestionPacket(set: number): ISetQuestionPacket {
    return {
      packetType: EPacketTypes.SET_QUESTION,
      set
    };
  }

  public static makeEndGamePacket(): IEndGamePacket {
    return {
      packetType: EPacketTypes.END_GAME
    };
  }

  public static makeKeypressOnScreenPacket(keyCode: string): IKeypressOnScreenPacket {
    return {
      packetType: EPacketTypes.KEYPRESS_ON_SCREEN,
      keyCode
    };
  }

  public static makeMarkTeamPacket(teamId: string, marked: boolean = true): IMarkTeamPacket {
    return {
      packetType: EPacketTypes.MARK_TEAM,
      teamId,
      mark: marked
    };
  }


}
