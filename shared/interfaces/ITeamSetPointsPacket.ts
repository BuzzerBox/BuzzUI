import {IGamePacket, EPacketTypes} from '../shared';

export interface ITeamSetPointsPacket extends IGamePacket {
    packetType: EPacketTypes.TEAM_SET_POINTS;
    points: number;
    teamId: string;
}
