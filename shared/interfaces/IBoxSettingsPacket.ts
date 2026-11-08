import {IGamePacket, EPacketTypes} from '../shared';

/**
 * One setting of buzzerbox.txt on the box's boot partition, see BoxSettingsHelper
 */
export interface IBoxSetting {
    /** e.g. WIFI_SSID */
    key: string;
    /**
     * The value the box uses from its next start on: the file's, or the default if the file has none or an invalid one
     */
    value: string;
    /** whether value is the default, since the file has no valid value of its own */
    isDefault: boolean;
    /** the file's value if the box ignores it as invalid */
    invalidValue?: string;
}

/**
 * A public key in buzzerbox-ssh-keys.txt on the box's boot partition, which may log into the box over SSH
 */
export interface IBoxSshKey {
    /** e.g. ssh-ed25519 */
    type: string;
    /** what follows the key, usually user@computer; may be empty */
    comment: string;
    /** as ssh-keygen -l shows it: SHA256:… */
    fingerprint: string;
    /**
     * Whether the box has taken it (it does on every start and when the master changes the keys); undefined if that
     * is unknown, e.g. in dev
     */
    isActive?: boolean;
}

/**
 * What the box is built of, as far as the server can tell; every value may be missing (e.g. in dev on another computer)
 */
export interface IBoxHardware {
    /** e.g. Raspberry Pi Compute Module 4 Rev 1.1 */
    model?: string;
    /** the board's serial number, unique to each box */
    serialNumber?: string;
    memoryInBytes?: number;
    /** where the system runs from */
    storage?: {
        kind: 'emmc' | 'sd' | 'usb' | 'other';
        sizeInBytes?: number;
        freeInBytes?: number;
    };
    /** of the processor */
    temperatureInCelsius?: number;
    /** e.g. Debian GNU/Linux 12 (bookworm) */
    operatingSystem?: string;
    uptimeInSeconds?: number;
    /** the box's own software, e.g. 1.5.0 */
    softwareVersion?: string;
}

/**
 * Sent from the server to the master when it asks for the box's settings (REQUEST_BOX_SETTINGS) and after saving them
 */
export interface IBoxSettingsPacket extends IGamePacket {
    packetType: EPacketTypes.BOX_SETTINGS;
    /**
     * Whether this server has the settings at all: not in the test environment, or on a box from before buzzerbox.txt
     */
    available: boolean;
    /**
     * Whether the master may change them, which only buzzerbox.txt itself can allow (BoxSettingsHelper.EDIT_KEY)
     */
    editable: boolean;
    /** whether the master can restart the box, which the settings only count after */
    canRestart: boolean;
    settings: IBoxSetting[];
    /** whether the box has buzzerbox-ssh-keys.txt, i.e. SSH that keys can be added for */
    sshAvailable: boolean;
    sshKeys: IBoxSshKey[];
    /** who logs in with the keys, e.g. admin */
    sshUser: string;
    hardware: IBoxHardware;
    /** why the settings could not be read */
    error?: string;
}

/**
 * Sent from the master to change settings of buzzerbox.txt; the server answers with a response packet and, if they
 * were saved, an IBoxSettingsPacket. Only allowed while no game is set up.
 */
export interface ISaveBoxSettingsPacket extends IGamePacket {
    packetType: EPacketTypes.SAVE_BOX_SETTINGS;
    /** only the settings that change, by key */
    values: Record<string, string>;
}

/**
 * Sent from the master to allow a public key to log into the box over SSH, which counts right away; the server answers
 * with a response packet and an IBoxSettingsPacket. Only allowed if buzzerbox.txt allows changing the settings.
 */
export interface IAddSshKeyPacket extends IGamePacket {
    packetType: EPacketTypes.ADD_SSH_KEY;
    /** a line of a .pub file, e.g. ssh-ed25519 AAAA… user@computer */
    key: string;
}

/**
 * Sent from the master to remove a key of IBoxSettingsPacket.sshKeys, answered like IAddSshKeyPacket
 */
export interface IRemoveSshKeyPacket extends IGamePacket {
    packetType: EPacketTypes.REMOVE_SSH_KEY;
    /** IBoxSshKey.fingerprint */
    fingerprint: string;
}
