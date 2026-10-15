import {IGamePacket, EPacketTypes, IUpdateBundle, IUpdateStatus} from '../shared';

/**
 * Sent from the server to the master when it registers and whenever the update bundles on the USB sticks or the state
 * of an update change.
 */
export interface IUpdateInfoPacket extends IGamePacket {
    packetType: EPacketTypes.UPDATE_INFO;
    /**
     * Whether this server can update itself at all (it can't in dev mode or in the test environment, for example)
     */
    enabled: boolean;
    installedVersion: string;
    bundles: IUpdateBundle[];
    /**
     * The state of the last update, if it is recent
     */
    status?: IUpdateStatus;
}
