import {EPacketTypes, IGamePacket} from "../shared";

export interface IMarkTeamPacket extends IGamePacket {
    packetType: EPacketTypes.MARK_TEAM;
    teamId: string;
    mark: boolean;
    /**
     * if that one is set to TRUE; then teamId and mark will be ignored
     */
    unmarkAll?: boolean
}
