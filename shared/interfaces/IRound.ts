import {IQuestion} from './IQuestion';

/**
 * How a round is played, see RoundRulesHelper for the rules of each mode. Jeopardy and a final are planned as further
 * modes (#120).
 */
export type TRoundMode = 'classic';

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

export type IRound = IClassicRound;

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
 * How far a round got; IGameState.roundProgress has one for each round of the game
 */
export type IRoundProgress = IClassicRoundProgress;

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
