import {IGamePacket} from './IGamePacket';
import {EPacketTypes} from '../enums/EPacketTypes';

/**
 * Sent from the master to switch the box into an extension's mode (e.g. another game on the same screens) or back to
 * the quiz, and from the server to the master and the screens whenever it changes and when they register. While an
 * extension's mode is on, the master and the screens show its pages, and no game can be set up. See
 * docs/extensions.md.
 */
export interface ISetActiveExtensionPacket extends IGamePacket {
    packetType: EPacketTypes.SET_ACTIVE_EXTENSION;
    /** The ID of the extension whose mode is on, or null for the quiz */
    extensionId: string | null;
}
