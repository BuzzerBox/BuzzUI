import {IGamePacket, IWebSocketMessage, IResponsePacket, EPacketTypes, IMarkTeamPacket} from "../../shared/objects/shared";

export class PacketHelper {
    private constructor() {
        // making it private to avoid this class being instantiated
    }

    public static makeResponsePacket(responseTo: EPacketTypes, wasSuccessful: boolean, reason?: string): IResponsePacket {
        return {
            packetType: EPacketTypes.RESPONSE_PACKET,
            responseTo: responseTo,
            wasSuccessful,
            reason
        };
    }

    public static makeMarkTeamPacket(teamId: string, mark: boolean): IMarkTeamPacket {
        return {
            packetType: EPacketTypes.MARK_TEAM,
            teamId,
            mark
        };
    }

    public static makeUnmarkAllTeamsPacket(): IMarkTeamPacket {
        const p: IMarkTeamPacket = this.makeMarkTeamPacket(null, null);
        p.unmarkAll = true
        return p;
    }
}
