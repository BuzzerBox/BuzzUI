import {IGamePacket, EPacketTypes} from '../shared';

/**
 * Sent from the server to the master when another device took over as master (see IRegisterMasterPacket.takeOver),
 * right before the server closes the connection
 */
export interface IMasterTakenOverPacket extends IGamePacket {
    packetType: EPacketTypes.MASTER_TAKEN_OVER;
}
