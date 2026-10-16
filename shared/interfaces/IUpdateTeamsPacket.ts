import {IGamePacket, EPacketTypes, ITeam} from '../shared';

/**
 * Changes the teams of a game that is set up: the master sends the teams it wants (renamed, added or removed), the
 * server keeps the points of the teams it already has and sends the resulting teams to the master and the screens.
 */
export interface IUpdateTeamsPacket extends IGamePacket {
    packetType: EPacketTypes.UPDATE_TEAMS;
    teams: ITeam[];
}
