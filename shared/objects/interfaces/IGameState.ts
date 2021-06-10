import {IGamePacket, EPacketTypes, IAnswer} from '../shared';

export const CURRENT_SAVEGAME_VERSION = 0;

export interface IGameState {
    currentQuestionNumber: number;
    markedTeamIds: string[];
    loggedAnswers: IAnswer[];
    activatedAnswer?: IAnswer;
}
