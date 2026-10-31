import {IGamePacket, EPacketTypes, IUsbBuzzer} from '../shared';

/**
 * Sent from the server to the master when it registers and whenever a wireless buzzer is plugged in over USB, changes
 * its state (see IUsbBuzzer) or is unplugged. Holds all buzzers that are plugged in.
 */
export interface IUsbBuzzersPacket extends IGamePacket {
    packetType: EPacketTypes.USB_BUZZERS;
    buzzers: IUsbBuzzer[];
}
