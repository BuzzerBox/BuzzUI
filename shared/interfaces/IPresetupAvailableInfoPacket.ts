import {EPacketTypes, IGamePacket, IResponsePacket, IBuzzer} from '../shared';

export interface IPresetupAvailableInfoPacket {
    packetType: EPacketTypes.PRESETUP_AVAILABLE_INFO;
    /**
     * Contains the IDs of all the available buzzers
     */
    availableBuzzers: IBuzzer[];
}
