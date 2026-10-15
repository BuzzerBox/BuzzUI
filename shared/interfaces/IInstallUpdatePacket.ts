import {IGamePacket, EPacketTypes} from '../shared';

/**
 * Sent from the master to install an update bundle. The server only accepts it while no game is set up, since
 * installing restarts the server.
 */
export interface IInstallUpdatePacket extends IGamePacket {
    packetType: EPacketTypes.INSTALL_UPDATE;
    /**
     * The fileName of one of the bundles of the last IUpdateInfoPacket
     */
    fileName: string;
}
