import {IGamePacket, EPacketTypes} from  '../shared';
import {EVideoStates} from "../enums/EVideoStates";

export interface IUpdateMediaStatePacket extends IGamePacket {
    packetType: EPacketTypes.UPDATE_MEDIA_STATE;
    newState: EVideoStates;
    timeStamp: number;
}
