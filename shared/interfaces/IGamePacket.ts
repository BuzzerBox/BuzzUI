import {EPacketTypes, IWebSocketMessage} from '../shared'

export interface IGamePacket extends IWebSocketMessage {
    packetType: EPacketTypes
};
