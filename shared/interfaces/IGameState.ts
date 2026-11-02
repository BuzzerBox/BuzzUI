import {IGamePacket, EPacketTypes, IAnswer} from '../shared';
import {IMediaQuestionState} from "./IMediaQuestionState";
import {IMediaVolume} from "./IMediaVolume";
import {IScoring} from "./IScoring";

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
    /**
     * How answers are scored, from the game's version (IGameDefinition.scoring); set when the game is set up. Missing in
     * states from before it existed, which means the scoring from before, see ScoringHelper.
     */
    scoring?: IScoring;
    /**
     * A new game starts with a welcome screen instead of its first question, with the buzzers locked; the master's
     * "Spiel starten" goes to the first question, which ends it. Missing in states from before it existed.
     */
    welcome?: boolean;
    /**
     * The name of the stored game that is played, for the welcome screen; set when the game is set up
     */
    gameName?: string;
}
