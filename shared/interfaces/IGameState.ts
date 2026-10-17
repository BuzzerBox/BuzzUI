import {IAnswer} from './IAnswer';
import {IRoundProgress} from './IRound';
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
    /**
     * The round that is played, see IRound.id
     */
    currentRoundId: string;
    /**
     * How far each round got, by IRound.id, so going back to a round continues it. States saved before rounds existed
     * had currentQuestionNumber instead, see GameFormatHelper.migrateGameState.
     */
    roundProgress: Record<string, IRoundProgress>;
    markedTeamIds: string[];
    loggedAnswers: IAnswer[];
    // the answers of the current question that were revealed; missing in savegames from before it was tracked
    activatedAnswers?: IAnswer[];
    setBuzzerLock: boolean;
    mediaQuestionState: IMediaQuestionState;
    mediaVolume: IMediaVolume;
    /**
     * How the screens look, one of the client's screen themes; chosen when the game is set up. Missing in states from
     * before themes existed, and an unknown one (e.g. from a newer version), means the default theme.
     */
    themeId?: string;
}
