import {IGamePacket, EPacketTypes} from '../shared';

export interface IResetServerPacket extends IGamePacket {
    packetType: EPacketTypes.RESET_SERVER;
    // from the master: deletes the running game's state instead of saving it, so it can't be continued
    discardState?: boolean;
}
