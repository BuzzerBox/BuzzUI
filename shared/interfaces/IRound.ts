import {IQuestion} from './IQuestion';

/**
 * How a round is played, see RoundRulesHelper for the rules of each mode. A final is planned as a further mode (#120).
 */
export type TRoundMode = 'classic' | 'jeopardy';

interface IRoundBase {
    /**
     * Stable within the game, so a state can tell its rounds apart even if they are reordered in a later version
     */
    id: string;
    mode: TRoundMode;
    /**
     * Shown to the master and on the screens, e.g. "Runde 1"
     */
    name: string;
}

/**
 * The questions one after the other; every team may buzz, a correct answer is worth the points of the question
 */
export interface IClassicRound extends IRoundBase {
    mode: 'classic';
    questions: IQuestion[];
}

/**
 * A column of a Jeopardy board
 */
export interface IJeopardyCategory {
    name: string;
    /**
     * One for each of the board's values: questions[i] is worth values[i]. Their own points don't count.
     */
    questions: IQuestion[];
}

/**
 * A board of categories × values. A team picks a tile, every team may buzz; a correct answer is worth the tile's value
 * and closes it, a wrong one costs it.
 */
export interface IJeopardyRound extends IRoundBase {
    mode: 'jeopardy';
    /**
     * The rows of the board, from the top
     */
    values: number[];
    categories: IJeopardyCategory[];
}

export type IRound = IClassicRound | IJeopardyRound;

/**
 * How far a classic round got
 */
export interface IClassicRoundProgress {
    /**
     * Null for a round without questions
     */
    currentQuestionId: string | null;
}

/**
 * How far a Jeopardy round got
 */
export interface IJeopardyRoundProgress {
    /**
     * The tiles that are closed, by the IDs of their questions
     */
    playedQuestionIds: string[];
    /**
     * The tile that is shown, null while the board is shown
     */
    openQuestionId: string | null;
    /**
     * The team that picks the next tile, null until the master chose who starts. Set to the team that answered
     * correctly, and changeable by the master.
     */
    pickingTeamId: string | null;
}

/**
 * How far a round got; IGameState.roundProgress has one for each round of the game
 */
export type IRoundProgress = IClassicRoundProgress | IJeopardyRoundProgress;

/**
 * Where a game is, for lists and the master, all counted from 1
 */
export interface IGameProgress {
    roundNumber: number;
    roundCount: number;
    /**
     * Within the round
     */
    questionNumber: number;
    /**
     * Of the round
     */
    questionCount: number;
}
