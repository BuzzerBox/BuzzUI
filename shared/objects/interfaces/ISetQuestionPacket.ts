import {IGamePacket, EPacketTypes} from '../shared';

export interface ISetQuestionPacket extends IGamePacket {
    packetType: EPacketTypes.SET_QUESTION;
    /**
     * If a number is sent, then it the question with that ID shall be set
     */
    set: number;
}
