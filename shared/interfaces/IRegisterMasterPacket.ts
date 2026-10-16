import {IGamePacket} from './IGamePacket';
import {EPacketTypes} from '../enums/EPacketTypes'

export interface IRegisterMasterPacket extends IGamePacket {
    packetType: EPacketTypes.REGISTER_MASTER;
    /**
     * The master's clock (Date.now()). The box has no battery-backed clock and no internet to set it, so the server
     * takes the time it saves games with from the master.
     */
    clientTime?: number;
}
