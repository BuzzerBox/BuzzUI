import {IGamePacket, EPacketTypes} from '../shared';

/**
 * Sent from the server to the master when it registers. Only the master may use the storage API (save games and media
 * on the box and the USB sticks), so the API wants this token in every request, see StorageApiHelper.TOKEN_HEADER.
 * It is valid until the master's connection closes.
 */
export interface IStorageAccessPacket extends IGamePacket {
    packetType: EPacketTypes.STORAGE_ACCESS;
    token: string;
}
