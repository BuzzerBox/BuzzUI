import {IGamePacket, EPacketTypes, IAnswer} from '../shared';
import {IMediaQuestionState} from "./IMediaQuestionState";

/**
 * ALYWAYS UPDATE THIS NUMBER IF SOMETHING CHANGED AND KEEP TRACK OF CHANGES
 *
 * 0 -> 1:
 *  added setBuzzerLock: boolean;
 * 2 -> 3:
 *  replaced mediaState: EVideoStates with mediaQuestionState: IMediaQuestionState
 *  (version 2 savegames are still accepted and migrated on import)
 */
export const CURRENT_SAVEGAME_VERSION = 3;

export interface IGameState {
    currentQuestionNumber: number;
    markedTeamIds: string[];
    loggedAnswers: IAnswer[];
    activatedAnswer?: IAnswer;
    setBuzzerLock: boolean;
    mediaQuestionState: IMediaQuestionState;
}
