import {IGamePacket, EPacketTypes} from '../shared';
import {IMediaVolume} from './IMediaVolume';

export interface ISetMediaVolumePacket extends IGamePacket {
    packetType: EPacketTypes.SET_MEDIA_VOLUME;
    mediaVolume: IMediaVolume;
}
