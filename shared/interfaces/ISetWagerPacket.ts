import {IGamePacket, EPacketTypes} from '../shared';

/**
 * Sent by the master with what a team wagers: the team that picked a Daily Double, or every team in the final. The
 * server keeps it within what the team may wager (see getMaxWager of the rules) and forwards it to the screens.
 */
export interface ISetWagerPacket extends IGamePacket {
    packetType: EPacketTypes.SET_WAGER;
    teamId: string;
    wager: number;
}
