import {IQuestion} from './IQuestion';
import {EGradeResults} from '../enums/EGradeResults';

/**
 * How a round is played, see RoundRulesHelper for the rules of each mode
 */
export type TRoundMode = 'classic' | 'jeopardy' | 'final';

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
    /**
     * The tiles that are a Daily Double, by the IDs of their questions: only the team that picked answers, for a wager
     */
    dailyDoubleQuestionIds?: string[];
}

/**
 * One question to end the game with: the category is shown first, every team wagers on it, then the question follows.
 * The teams write their answers down, and the master grades every team.
 */
export interface IFinalRound extends IRoundBase {
    mode: 'final';
    category: string;
    question: IQuestion;
}

export type IRound = IClassicRound | IJeopardyRound | IFinalRound;

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
    /**
     * The wager on the open Daily Double, by team ID; empty for other tiles and while the board is shown
     */
    wagers: Record<string, number>;
    /**
     * The teams that answered the open tile wrong; with IPlayOptions.oneTryPerTile they can't buzz on it again
     */
    lockedOutTeamIds: string[];
}

/**
 * How far the final got
 */
export interface IFinalRoundProgress {
    /**
     * False while the category is shown and the teams wager
     */
    questionShown: boolean;
    /**
     * By team ID
     */
    wagers: Record<string, number>;
    /**
     * How the master graded each team that is graded already, by team ID
     */
    gradeResults: Record<string, EGradeResults>;
}

/**
 * How far a round got; IGameState.roundProgress has one for each round of the game
 */
export type IRoundProgress = IClassicRoundProgress | IJeopardyRoundProgress | IFinalRoundProgress;

/**
 * How a play of a game goes, chosen when it is set up
 */
export interface IPlayOptions {
    /**
     * Jeopardy: a team that answered a tile wrong can't buzz on it again. On unless it is false.
     */
    oneTryPerTile?: boolean;
}

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
