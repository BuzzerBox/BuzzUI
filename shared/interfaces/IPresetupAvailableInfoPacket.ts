import {EPacketTypes, IGamePacket, IResponsePacket, IBuzzer} from '../shared';

export interface IPresetupAvailableInfoPacket {
    packetType: EPacketTypes.PRESETUP_AVAILABLE_INFO;
    /**
     * Contains the IDs of all the available buzzers
     */
    availableBuzzers: IBuzzer[];
    /**
     * False on a box without analog buzzers (ANALOG_BUZZERS=no in buzzerbox.txt), which only offers the wireless ones;
     * missing from servers before this setting, which always had them
     */
    analogBuzzers?: boolean;
}
