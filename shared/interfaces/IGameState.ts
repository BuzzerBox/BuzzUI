import {IGamePacket, EPacketTypes, IAnswer, EVideoStates} from '../shared';

/**
 * ALYWAYS UPDATE THIS NUMBER IF SOMETHING CHANGED AND KEEP TRACK OF CHANGES
 *
 * 0 -> 1:
 *  added setBuzzerLock: boolean;
 */
export const CURRENT_SAVEGAME_VERSION = 2;

export interface IGameState {
    currentQuestionNumber: number;
    markedTeamIds: string[];
    loggedAnswers: IAnswer[];
    activatedAnswer?: IAnswer;
    setBuzzerLock: boolean;
    mediaState: EVideoStates;
}
