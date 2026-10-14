import {IGamePacket, EPacketTypes, IAnswer} from '../shared';
import {IMediaQuestionState} from "./IMediaQuestionState";
import {IMediaVolume} from "./IMediaVolume";

/**
 * ALYWAYS UPDATE THIS NUMBER IF SOMETHING CHANGED AND KEEP TRACK OF CHANGES
 *
 * 0 -> 1:
 *  added setBuzzerLock: boolean;
 * 2 -> 3:
 *  replaced mediaState: EVideoStates with mediaQuestionState: IMediaQuestionState
 *  added mediaVolume: IMediaVolume
 *  added optional notes to the questions
 *  added optional slides to the questions' mediaDetails and slideIndex to mediaQuestionState
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
    mediaVolume: IMediaVolume;
}
