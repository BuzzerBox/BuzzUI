import {IGamePacket, EPacketTypes} from '../shared';

/**
 * Sent from the master to give a wireless buzzer that is plugged in over USB the box's WiFi; the server reports how it
 * went in IUsbBuzzersPacket
 */
export interface IAdoptUsbBuzzerPacket extends IGamePacket {
    packetType: EPacketTypes.ADOPT_USB_BUZZER;
    /** IUsbBuzzer.path */
    path: string;
    /**
     * The color of the buzzer's case ("#rrggbb"), which the buzzer keeps; "" takes it away and a missing one keeps the
     * one it has. Firmware before 1.2.0 ignores it.
     */
    color?: string;
}
