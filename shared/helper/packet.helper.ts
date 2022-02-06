import {
    IAnswer,
    IAnswerSetStatePacket,
    IEndGamePacket,
    IGameState,
    IKeypressOnScreenPacket,
    IMarkTeamPacket,
    INewMasterAccepted,
    IQuestion,
    IRegisterMasterPacket,
    IRegisterScreenPacket,
    IResetServerPacket,
    IResponsePacket,
    ISetBuzzerLockPacket,
    ISetQuestionPacket,
    ISetupPacket,
    IStartGamePacket,
    ITeam,
    ITeamSetPointsPacket,
    IUpdateMediaStatePacket
} from '../interfaces';

import {EAnswerStates, EGameStates, EPacketTypes, EVideoStates} from '../enums';

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

    public static makeMediaStatePacket(state: EVideoStates, timestamp: number | undefined): IUpdateMediaStatePacket {
        return {
            newState: state,
            timeStamp: timestamp,
            packetType: EPacketTypes.UPDATE_MEDIA_STATE,
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

    public static makeRegisterScreenPacket(id: string): IRegisterScreenPacket {
        return {
            packetType: EPacketTypes.REGISTER_SCREEN,
            screenId: id
        }
    }

    public static makeNewMasterAcceptedPacket(serverState: EGameStates, teams: ITeam[], questions: IQuestion[], currentGameState?: IGameState): INewMasterAccepted {
        return {
            packetType: EPacketTypes.NEW_MASTER_ACCEPTED,
            teams,
            currentGameState,
            questions,
            serverState
        }
    }

    public static makeSetupPacket(teams: ITeam[], questions: IQuestion[], currentGameState?: IGameState): ISetupPacket {
        return {
            packetType: EPacketTypes.SETUP_GAME,
            teams,
            questions,
            currentGameState
        }
    }

    public static makeRegisterMasterPacket(): IRegisterMasterPacket {
        return {
            packetType: EPacketTypes.REGISTER_MASTER
        }
    }

    public static makeStartGamePacket(): IStartGamePacket {
        return {
            packetType: EPacketTypes.START_GAME
        }
    }

    public static makeResetServerPacket(): IResetServerPacket {
        return {
            packetType: EPacketTypes.RESET_SERVER
        }
    }

    public static makeTeamSetPointsPacket(points: number, teamId: string): ITeamSetPointsPacket {
        return {
            packetType: EPacketTypes.TEAM_SET_POINTS,
            points,
            teamId
        }
    }

    public static makeUpdateMediaStatePacket(newState: EVideoStates, timeStamp: number): IUpdateMediaStatePacket {
        return {
            packetType: EPacketTypes.UPDATE_MEDIA_STATE,
            newState,
            timeStamp
        }
    }
}
