import {IGamePacket} from './IGamePacket';
import {EPacketTypes} from '../enums/EPacketTypes';
import {IBuzzer} from './IBuzzer';

/**
 * Sent by the server to the master whenever the set of online UDP buzzers changes.
 * The client should merge this list with the static serial buzzer list.
 */
export interface IUdpBuzzerUpdatePacket extends IGamePacket {
    packetType: EPacketTypes.UDP_BUZZER_UPDATE;
    buzzers: IBuzzer[];
}
