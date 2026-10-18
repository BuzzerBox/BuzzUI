import {IQuestion} from '../interfaces/IQuestion';
import {IPlayOptions, IRound, IRoundProgress} from '../interfaces/IRound';
import {EGradeResults} from '../enums/EGradeResults';

/**
 * The rules of a round mode, which the server and the master both follow. Every mode implements them, see
 * RoundRulesHelper.
 */
export interface IRoundRules<R extends IRound = IRound, P extends IRoundProgress = IRoundProgress> {
    /**
     * Whether a round read from a file (with a mode of these rules) has everything these rules need
     */
    isWellFormed(round: unknown): boolean;

    /**
     * How the round starts, or how it goes on from what a state saved: what doesn't fit the round (e.g. a question that
     * isn't in it, from a broken file) starts over
     */
    completeProgress(round: R, progress: Partial<P> | undefined): P;

    /**
     * Every question of the round, e.g. to check their media
     */
    getQuestions(round: R): IQuestion[];

    /**
     * The round with every question changed, e.g. with the URLs of their media
     */
    mapQuestions(round: R, map: (question: IQuestion) => IQuestion): R;

    /**
     * The question that is shown, undefined if there is none
     */
    getCurrentQuestion(round: R, progress: P): IQuestion | undefined;

    /**
     * The place of the current question in the round, counted from 0
     */
    getCurrentQuestionIndex(round: R, progress: P): number;

    /**
     * The progress with the question at that place shown, or null if there is none
     */
    selectQuestion(round: R, progress: P, index: number): P | null;

    hasPreviousQuestion(round: R, progress: P): boolean;

    hasNextQuestion(round: R, progress: P): boolean;

    /**
     * Whether the round is done, so the game goes on with the next round or ends
     */
    isOver(round: R, progress: P): boolean;

    /**
     * Whether the team may buzz now; the server turns off the buzzers of the teams that may not, see GameService
     */
    mayBuzz(round: R, progress: P, teamId: string, options: IPlayOptions): boolean;

    /**
     * Whether the master may grade the answer of the team now, e.g. not twice in the final
     */
    mayGrade(round: R, progress: P, teamId: string, options: IPlayOptions): boolean;

    /**
     * What a graded answer of the team adds to its points; negative for a wrong one
     */
    getGradePoints(round: R, progress: P, result: EGradeResults, teamId: string): number;

    /**
     * How the round goes on after the master graded the answer of the team; the server, the master and the screens
     * each apply it when they get the IGradeAnswerPacket
     */
    afterGrade(round: R, progress: P, teamId: string, result: EGradeResults): P;
}
