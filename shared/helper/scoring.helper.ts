import {IScoring, TDoubleAnswerScoring, TWrongAnswerScoring} from '../interfaces/IScoring';
import {EGradeResults} from '../enums/EGradeResults';

export class ScoringHelper {
    public static readonly DOUBLE_ANSWER_SCORINGS: TDoubleAnswerScoring[] = ['none', 'plusOne', 'double'];
    public static readonly WRONG_ANSWER_SCORINGS: TWrongAnswerScoring[] = ['questionPoints', 'one', 'none'];
    /**
     * How a game made in the editor starts: no double grade and no deduction. Games saved without a scoring keep the
     * one from before, see complete().
     */
    public static readonly NEW_GAME_SCORING: IScoring = {doubleAnswer: 'none', wrongAnswer: 'none'};

    private constructor() {
    }

    /**
     * Fills in the settings a game lacks, e.g. one saved before they existed, with the scoring from before
     */
    public static complete(scoring: Partial<IScoring> | undefined): IScoring {
        return {
            doubleAnswer: scoring?.doubleAnswer ?? 'double',
            wrongAnswer: scoring?.wrongAnswer ?? 'questionPoints'
        };
    }

    /**
     * Whether it only has known settings, e.g. when a game version is saved
     */
    public static isValid(scoring: unknown): scoring is Partial<IScoring> {
        if (typeof scoring !== 'object' || scoring == null || Array.isArray(scoring)) {
            return false;
        }
        const {doubleAnswer, wrongAnswer, ...rest} = scoring as Record<string, unknown>;
        return Object.keys(rest).length === 0
            && (doubleAnswer === undefined || this.DOUBLE_ANSWER_SCORINGS.includes(doubleAnswer as TDoubleAnswerScoring))
            && (wrongAnswer === undefined || this.WRONG_ANSWER_SCORINGS.includes(wrongAnswer as TWrongAnswerScoring));
    }

    public static isAllowed(result: EGradeResults, scoring: Partial<IScoring> | undefined): boolean {
        return result !== EGradeResults.DOUBLE || this.complete(scoring).doubleAnswer !== 'none';
    }

    /**
     * What a grade adds to the team's points, for a question worth questionPoints; negative for a wrong answer that
     * costs points
     */
    public static getPointsChange(result: EGradeResults, questionPoints: number, scoring: Partial<IScoring> | undefined): number {
        const complete = this.complete(scoring);
        switch (result) {
            case EGradeResults.DOUBLE:
                return complete.doubleAnswer === 'plusOne' ? questionPoints + 1 : 2 * questionPoints;
            case EGradeResults.WRONG:
                switch (complete.wrongAnswer) {
                    case 'none':
                        return 0;
                    case 'one':
                        return -1;
                    default:
                        return -questionPoints;
                }
            default:
                return questionPoints;
        }
    }
}
