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
    /**
     * When the server refuses a master since another one is connected: whether that one is in a game (and not just
     * setting one up), so the refused master can tell what taking over would do
     */
    isGameRunning?: boolean;
};
