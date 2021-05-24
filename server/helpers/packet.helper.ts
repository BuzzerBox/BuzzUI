import {IGamePacket, IWebSocketMessage, IResponsePacket, EPacketTypes} from "../../shared/objects/shared";

export class PacketHelper {
    private constructor() {
        // making it private to avoid this class being instantiated
    }

    public static makeResponsePacket(responseTo: EPacketTypes, wasSuccessful: boolean, reason?: string): IResponsePacket {
        return {
            packetType: EPacketTypes.RESPONSE_PACKET,
            responseTo: responseTo,
            wasSuccessful,
            reason
        };
    }
}
