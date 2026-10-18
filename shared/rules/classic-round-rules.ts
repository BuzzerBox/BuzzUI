import {IQuestion} from '../interfaces/IQuestion';
import {IClassicRound, IClassicRoundProgress, IPlayOptions} from '../interfaces/IRound';
import {EGradeResults} from '../enums/EGradeResults';
import {IRoundRules} from './round-rules';

/**
 * The questions one after the other. Every team may buzz; a correct answer is worth the points of the question, a
 * double one twice them, and a wrong one takes them away.
 */
export class ClassicRoundRules implements IRoundRules<IClassicRound, IClassicRoundProgress> {
    public isWellFormed(round: unknown): boolean {
        return Array.isArray((round as Partial<IClassicRound>)?.questions);
    }

    public completeProgress(round: IClassicRound, progress: Partial<IClassicRoundProgress> | undefined): IClassicRoundProgress {
        const isInRound = round.questions.some(question => question.id === progress?.currentQuestionId);
        return {currentQuestionId: isInRound ? progress.currentQuestionId : (round.questions[0]?.id ?? null)};
    }

    public getQuestions(round: IClassicRound): IQuestion[] {
        return round.questions;
    }

    public mapQuestions(round: IClassicRound, map: (question: IQuestion) => IQuestion): IClassicRound {
        return {...round, questions: round.questions.map(map)};
    }

    public getCurrentQuestion(round: IClassicRound, progress: IClassicRoundProgress): IQuestion | undefined {
        return round.questions[this.getCurrentQuestionIndex(round, progress)];
    }

    public getCurrentQuestionIndex(round: IClassicRound, progress: IClassicRoundProgress): number {
        return Math.max(0, round.questions.findIndex(question => question.id === progress?.currentQuestionId));
    }

    public selectQuestion(round: IClassicRound, progress: IClassicRoundProgress, index: number): IClassicRoundProgress | null {
        const question = round.questions[index];
        return question ? {...progress, currentQuestionId: question.id} : null;
    }

    public hasPreviousQuestion(round: IClassicRound, progress: IClassicRoundProgress): boolean {
        return this.getCurrentQuestionIndex(round, progress) > 0;
    }

    public hasNextQuestion(round: IClassicRound, progress: IClassicRoundProgress): boolean {
        return this.getCurrentQuestionIndex(round, progress) < round.questions.length - 1;
    }

    public isOver(round: IClassicRound, progress: IClassicRoundProgress): boolean {
        return !this.hasNextQuestion(round, progress);
    }

    public mayBuzz(round: IClassicRound, progress: IClassicRoundProgress, teamId: string, options: IPlayOptions): boolean {
        return true;
    }

    public mayGrade(round: IClassicRound, progress: IClassicRoundProgress, teamId: string, options: IPlayOptions): boolean {
        return true;
    }

    public getGradePoints(round: IClassicRound, progress: IClassicRoundProgress, result: EGradeResults, teamId: string): number {
        const factor = result === EGradeResults.DOUBLE ? 2 : result === EGradeResults.CORRECT ? 1 : -1;
        return factor * ClassicRoundRules.getQuestionPoints(this.getCurrentQuestion(round, progress));
    }

    public afterGrade(round: IClassicRound, progress: IClassicRoundProgress, teamId: string, result: EGradeResults): IClassicRoundProgress {
        // the master goes on to the next question by hand
        return progress;
    }

    /**
     * Missing means 1 point, as in savegames from before points could be set
     */
    public static getQuestionPoints(question: IQuestion | null | undefined): number {
        return question?.points ?? 1;
    }
}
