/**
 * "box" is the storage inside the BuzzerBox, "usb" a USB stick
 */
export type TStorageLocationType = 'box' | 'usb';

/**
 * A place save games and media can be stored: the box itself or one of the USB sticks plugged into it
 */
export interface IStorageLocation {
    /**
     * Identifies the location in the storage API, see StorageApiHelper
     */
    id: string;
    type: TStorageLocationType;
    /**
     * For display: "BuzzerBox" or the name of the USB stick
     */
    name: string;
    /**
     * False for a read-only USB stick, for example
     */
    writable: boolean;
    /**
     * Free and total space in bytes, if they could be determined
     */
    freeBytes?: number;
    totalBytes?: number;
    /**
     * Where the games are below the media URL, e.g. "/BuzzerBox" or "/<stick>/buzzerbox-games"; a game's media are in
     * "<gamesPath>/<game>/media"
     */
    gamesPath: string;
    /**
     * Only for USB sticks: where the stick's other media are below the media URL, e.g. "/<stick>"
     */
    mediaPath?: string;
}
