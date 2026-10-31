import {IGamePacket, EPacketTypes} from '../shared';

export interface ISetQuestionPacket extends IGamePacket {
    packetType: EPacketTypes.SET_QUESTION;
    /**
     * The place of the question in the current round, counted from 0
     */
    set: number;
}
