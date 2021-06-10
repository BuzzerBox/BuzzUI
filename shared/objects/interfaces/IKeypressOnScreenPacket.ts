import {EPacketTypes, IGamePacket} from "../shared";

export interface IKeypressOnScreenPacket extends IGamePacket {
    packetType: EPacketTypes.KEYPRESS_ON_SCREEN;
    keyCode: string;
}
