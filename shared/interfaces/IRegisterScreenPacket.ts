import {IGamePacket, EPacketTypes} from  '../shared';

export interface IRegisterScreenPacket extends IGamePacket {
    packetType: EPacketTypes.REGISTER_SCREEN;
    screenId: string;
}
