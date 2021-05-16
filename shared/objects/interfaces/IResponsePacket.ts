import {EPacketTypes, IGamePacket} from '../shared';

export interface IResponsePacket extends IGamePacket{
    packetType: EPacketTypes.RESPONSE_PACKET;
    /**
     * What packet type this repsonse is a response to
     */
    responseTo: EPacketTypes;
    wasSuccessful: boolean;
};
