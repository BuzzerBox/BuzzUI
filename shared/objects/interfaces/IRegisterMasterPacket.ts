import {IGamePacket} from './IGamePacket';
import {EPacketTypes} from '../enums/EPacketTypes'

export interface IRegisterMasterPacket extends IGamePacket {
    packetType: EPacketTypes.REGISTER_MASTER;
}
