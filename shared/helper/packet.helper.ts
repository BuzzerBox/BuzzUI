import {
    IGamePacket,
    IWebSocketMessage,
    IResponsePacket,
    IMarkTeamPacket,
    ISetBuzzerLockPacket,
    IAnswer,
    IAnswerSetStatePacket,
    ISetQuestionPacket,
    IEndGamePacket,
    IKeypressOnScreenPacket
} from "../interfaces";

import {EPacketTypes, EAnswerStates} from '../enums';

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

    public static makeBuzzerLockPacket(setLock: boolean): ISetBuzzerLockPacket {
        return {
            packetType: EPacketTypes.SET_BUZZER_LOCK,
            setLock
        }
    }

    public static makeAnswerSetSatePacket(state: EAnswerStates, answer?: IAnswer): IAnswerSetStatePacket {
        return {
            packetType: EPacketTypes.ANSWER_SET_STATE,
            state,
            answer
        };
    }

    public static makeSetQuestionPacket(set: number): ISetQuestionPacket {
        return {
            packetType: EPacketTypes.SET_QUESTION,
            set
        };
    }

    public static makeEndGamePacket(): IEndGamePacket {
        return {
            packetType: EPacketTypes.END_GAME
        };
    }

    public static makeKeypressOnScreenPacket(keyCode: string): IKeypressOnScreenPacket {
        return {
            packetType: EPacketTypes.KEYPRESS_ON_SCREEN,
            keyCode
        };
    }
}
