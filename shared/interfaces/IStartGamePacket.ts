import {IGamePacket, EPacketTypes} from '../shared'; 

export interface IStartGamePacket extends IGamePacket {
    packetType: EPacketTypes.START_GAME;
}
