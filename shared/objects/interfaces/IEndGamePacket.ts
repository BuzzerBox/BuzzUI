import {IGamePacket, EPacketTypes} from '../shared';

export interface IEndGamePacket extends IGamePacket {
    packetType: EPacketTypes.END_GAME;
}
