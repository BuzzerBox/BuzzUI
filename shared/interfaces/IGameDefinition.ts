import {IGameState, IMediaQuestionDefaults, ITeam} from '../shared';
import {IRound} from './IRound';

/**
 * The format of game, state and bundle files; the savegames from before (CURRENT_SAVEGAME_VERSION) had teams,
 * questions and progress in one file
 *
 * 4 -> 5:
 *  replaced questions with rounds, each with a mode; the questions got IDs
 *  replaced currentQuestionNumber in the game state with currentRoundId and roundProgress
 *  (versions and states from before are migrated when they are loaded or imported, see GameFormatHelper; the files are
 *  never rewritten)
 */
export const CURRENT_GAME_FORMAT_VERSION = 5;

/**
 * One version of a game: its rounds and their questions. Versions are never changed, saving a game in the editor adds a new one, so a
 * state always plays the questions it was started with.
 */
export interface IGameDefinition {
    formatVersion: number;
    kind: 'game';
    /**
     * Set by the server when it stores the version
     */
    version: number;
    /**
     * When it was saved, as an ISO date
     */
    savedAt: string;
    /**
     * Played one after the other. The media of their questions (mediaDetails.fileSrc and slides) are paths relative to
     * the game's media folder, with "/" between folders.
     */
    rounds: IRound[];
    /**
     * How media questions start, for each kind of media, unless a question has its own initialConfig. Versions saved
     * before it existed have an initialConfig in every media question.
     */
    mediaDefaults?: Partial<IMediaQuestionDefaults>;
}

/**
 * One time a game is played: the teams and how far they got. The server saves it automatically while it is played.
 */
export interface IGameInstanceState {
    formatVersion: number;
    kind: 'state';
    /**
     * The version of the game that is played
     */
    gameVersion: number;
    createdAt: string;
    updatedAt: string;
    /**
     * Whether the game was ended
     */
    finished: boolean;
    teams: ITeam[];
    gameState: IGameState;
}

/**
 * A game version, optionally with a state, as one file to download to or upload from a device. The media aren't in it.
 */
export interface IGameBundle {
    formatVersion: number;
    kind: 'bundle';
    gameName: string;
    game: IGameDefinition;
    state?: IGameInstanceState;
    stateName?: string;
}
