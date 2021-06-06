import {IGamePacket, EPacketTypes, EAnswerStates, IAnswer} from '../shared';

export interface IAnswerSetStatePacket extends IGamePacket {
    packetType: EPacketTypes.ANSWER_SET_STATE;
    state: EAnswerStates;
    answer: IAnswer;
}
