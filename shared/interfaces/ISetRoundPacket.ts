import {IGamePacket, EPacketTypes} from '../shared';

/**
 * Sent by the master to play another round; the server forwards it to the screens. The round continues where it was
 * left, see IGameState.roundProgress.
 */
export interface ISetRoundPacket extends IGamePacket {
    packetType: EPacketTypes.SET_ROUND;
    roundId: string;
}
