/**
 * What an answer graded as double is worth: there is no such grade, the question's points plus one, or twice them
 */
export type TDoubleAnswerScoring = 'none' | 'plusOne' | 'double';

/**
 * What a wrong answer costs: the question's points, one point, or nothing
 */
export type TWrongAnswerScoring = 'questionPoints' | 'one' | 'none';

/**
 * How answers are scored in a game, set in the editor for each game (IGameDefinition.scoring). A new game starts
 * without a double grade or deduction; missing settings are the scoring from before they could be set, see
 * ScoringHelper.
 */
export interface IScoring {
    doubleAnswer: TDoubleAnswerScoring;
    wrongAnswer: TWrongAnswerScoring;
}
