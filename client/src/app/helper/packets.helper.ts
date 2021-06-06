import {EAnswerStates, IAnswer, EPacketTypes, IAnswerSetStatePacket, ISetQuestionPacket, IEndGamePacket} from '../../../../shared/objects/shared';

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


}
