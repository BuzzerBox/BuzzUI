import {EPacketTypes, IGamePacket} from '../shared';

export interface IResponsePacket extends IGamePacket{
    packetType: EPacketTypes.RESPONSE_PACKET;
    /**
     * What packet type this repsonse responds to
     */
    responseTo: EPacketTypes;
    wasSuccessful: boolean;
    /**
     * A reason, why it was not successfull
     */
    reason?: string;
};
