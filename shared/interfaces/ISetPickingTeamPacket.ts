import {IGamePacket, EPacketTypes} from '../shared';

/**
 * Sent by the master to choose the team that picks the next tile of the Jeopardy board; the server forwards it to the
 * screens
 */
export interface ISetPickingTeamPacket extends IGamePacket {
    packetType: EPacketTypes.SET_PICKING_TEAM;
    teamId: string | null;
}
