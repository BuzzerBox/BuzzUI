import {IGamePacket} from './IGamePacket';
import {EPacketTypes} from '../enums/EPacketTypes'

export interface IRegisterMasterPacket extends IGamePacket {
    packetType: EPacketTypes.REGISTER_MASTER;
    /**
     * The master's clock (Date.now()). The box has no battery-backed clock and no internet to set it, so the server
     * takes the time it saves games with from the master.
     */
    clientTime?: number;
    /**
     * Whether to take over from the master that is connected, instead of being refused. The server tells that master
     * with a MASTER_TAKEN_OVER packet and closes its connection; a running game goes on with the new master.
     */
    takeOver?: boolean;
}
