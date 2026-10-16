import {IGamePacket, EPacketTypes, IGameStorageRef} from '../shared';

/**
 * Sent from the server to the master whenever it saved the state of the running game, or failed to
 */
export interface IAutosaveInfoPacket extends IGamePacket {
    packetType: EPacketTypes.AUTOSAVE_INFO;
    /**
     * Null if no stored game is played
     */
    storage: IGameStorageRef | null;
    /**
     * "BuzzerBox" or the name of the USB stick
     */
    locationName?: string;
    /**
     * When the state was saved last, as an ISO date
     */
    savedAt?: string;
    /**
     * Why the last save failed, e.g. since the USB stick was pulled out; it is tried again with the next change
     */
    error?: string;
}
