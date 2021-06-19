import {IGamePacket, EPacketTypes} from '../shared';

export interface IResetServerPacket extends IGamePacket {
    packetType: EPacketTypes.RESET_SERVER;
}
