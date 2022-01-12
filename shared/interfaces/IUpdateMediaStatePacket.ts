import {IGamePacket, EPacketTypes} from '../shared';
import {IMediaQuestionState} from "./IMediaQuestionState";

export interface IUpdateMediaStatePacket extends IGamePacket {
    packetType: EPacketTypes.UPDATE_MEDIA_STATE;
    mediaQuestionState: IMediaQuestionState;
}
