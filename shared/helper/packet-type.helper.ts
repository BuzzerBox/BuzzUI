import {EPacketTypes} from '../enums/EPacketTypes';

/**
 * The packet types of the core are EPacketTypes, numbered from 0 and appended to at the end. Extensions number their
 * own from FIRST_EXTENSION_PACKET_TYPE, so that the core can grow without clashing with them (see docs/extensions.md).
 */
export class PacketTypeHelper {
    public static readonly FIRST_EXTENSION_PACKET_TYPE = 1000;

    private constructor() {
        // hide
    }

    public static isExtensionPacketType(packetType: EPacketTypes | number): boolean {
        return Number.isInteger(packetType) && packetType >= PacketTypeHelper.FIRST_EXTENSION_PACKET_TYPE;
    }
}
