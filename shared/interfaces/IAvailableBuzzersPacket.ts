import {IGamePacket, EPacketTypes, IBuzzer} from '../shared';

/**
 * Sent from the server to the master whenever the available buzzers change, i.e. a UDP buzzer was found, went offline
 * or came back. Holds all buzzers, in the order of IPresetupAvailableInfoPacket.availableBuzzers; new ones are only
 * ever appended, so a buzzer keeps its index (ITeam.buzzerIndex).
 */
export interface IAvailableBuzzersPacket extends IGamePacket {
    packetType: EPacketTypes.AVAILABLE_BUZZERS;
    availableBuzzers: IBuzzer[];
}
