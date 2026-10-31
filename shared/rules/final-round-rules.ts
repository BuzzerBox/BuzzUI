import {IQuestion} from '../interfaces/IQuestion';
import {IFinalRound, IFinalRoundProgress, IPlayOptions} from '../interfaces/IRound';
import {ISelectQuestionPacket} from '../interfaces/ISelectQuestionPacket';
import {EGradeResults} from '../enums/EGradeResults';
import {IRoundRules} from './round-rules';
import {WagerHelper} from './wager.helper';

/**
 * The final: the category is shown, every team wagers up to its points, then the master shows the question. Nobody
 * buzzes; the teams write their answers down, and the master grades every team once: it wins or loses its wager.
 */
export class FinalRoundRules implements IRoundRules<IFinalRound, IFinalRoundProgress> {
    public isWellFormed(round: unknown): boolean {
        const candidate = round as Partial<IFinalRound>;
        return typeof candidate?.category === 'string' && candidate.question != null && typeof candidate.question === 'object';
    }

    public completeProgress(round: IFinalRound, progress: Partial<IFinalRoundProgress> | undefined): IFinalRoundProgress {
        const gradeResults: Record<string, EGradeResults> = {};
        if (progress?.gradeResults != null && typeof progress.gradeResults === 'object') {
            for (const [teamId, result] of Object.entries(progress.gradeResults)) {
                if (Object.values(EGradeResults).includes(result)) {
                    gradeResults[teamId] = result;
                }
            }
        }
        return {
            questionShown: progress?.questionShown === true,
            wagers: WagerHelper.completeWagers(progress?.wagers),
            gradeResults
        };
    }

    public getQuestions(round: IFinalRound): IQuestion[] {
        return [round.question];
    }

    public mapQuestions(round: IFinalRound, map: (question: IQuestion) => IQuestion): IFinalRound {
        return {...round, question: map(round.question)};
    }

    /**
     * Only once the teams wagered and the master showed it
     */
    public getCurrentQuestion(round: IFinalRound, progress: IFinalRoundProgress): IQuestion | undefined {
        return progress?.questionShown ? round.question : undefined;
    }

    public getCurrentQuestionIndex(round: IFinalRound, progress: IFinalRoundProgress): number {
        return 0;
    }

    public selectQuestion(round: IFinalRound, progress: IFinalRoundProgress, index: number): IFinalRoundProgress | null {
        return null;
    }

    public hasPreviousQuestion(round: IFinalRound, progress: IFinalRoundProgress): boolean {
        return false;
    }

    public hasNextQuestion(round: IFinalRound, progress: IFinalRoundProgress): boolean {
        return false;
    }

    public isOver(round: IFinalRound, progress: IFinalRoundProgress): boolean {
        return !!progress?.questionShown;
    }

    public mayBuzz(round: IFinalRound, progress: IFinalRoundProgress, teamId: string, options: IPlayOptions): boolean {
        return false;
    }

    /**
     * Every team once, after the question was shown
     */
    public mayGrade(round: IFinalRound, progress: IFinalRoundProgress, teamId: string, options: IPlayOptions): boolean {
        return !!progress?.questionShown && progress.gradeResults?.[teamId] == null;
    }

    public getGradePoints(round: IFinalRound, progress: IFinalRoundProgress, result: EGradeResults, teamId: string): number {
        return WagerHelper.getPoints(progress?.wagers?.[teamId], result !== EGradeResults.WRONG);
    }

    public afterGrade(round: IFinalRound, progress: IFinalRoundProgress, teamId: string, result: EGradeResults): IFinalRoundProgress {
        return {...progress, gradeResults: {...progress.gradeResults, [teamId]: result}};
    }

    /**
     * Up to the team's points, nothing if it has none
     */
    public getMaxWager(teamPoints: number): number {
        return Math.max(teamPoints ?? 0, 0);
    }

    /**
     * The team's wager, kept within getMaxWager; null once the question is shown
     */
    public applySetWager(round: IFinalRound, progress: IFinalRoundProgress, teamId: string, wager: unknown,
                         teamPoints: number): IFinalRoundProgress | null {
        const value = WagerHelper.clamp(wager, this.getMaxWager(teamPoints));
        if (progress.questionShown || value == null) {
            return null;
        }
        return {...progress, wagers: {...progress.wagers, [teamId]: value}};
    }

    /**
     * Shows the question; null for another question, or to hide it again, which the final doesn't do
     */
    public applySelectQuestion(round: IFinalRound, progress: IFinalRoundProgress, packet: ISelectQuestionPacket): IFinalRoundProgress | null {
        return packet.questionId === round.question.id ? {...progress, questionShown: true} : null;
    }
}
