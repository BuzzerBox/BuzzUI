import {IGamePacket, EPacketTypes} from '../shared';

/**
 * Sent from the server in answer to EPacketTypes.REQUEST_GAME_INFO: whether a game runs, which the start page needs to
 * offer the points screen of a team
 */
export interface IGameInfoPacket extends IGamePacket {
    packetType: EPacketTypes.GAME_INFO;
    // a game is set up and not over yet, so the screens show it
    isGameRunning: boolean;
}
