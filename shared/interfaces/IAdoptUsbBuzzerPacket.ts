import {IGamePacket, EPacketTypes} from '../shared';

/**
 * Sent from the master to give a wireless buzzer that is plugged in over USB the box's WiFi; the server reports how it
 * went in IUsbBuzzersPacket
 */
export interface IAdoptUsbBuzzerPacket extends IGamePacket {
    packetType: EPacketTypes.ADOPT_USB_BUZZER;
    /** IUsbBuzzer.path */
    path: string;
}
