import {EGradeResults, ScoringHelper} from '../../../../shared/shared';

describe('ScoringHelper', () => {
  it('scores as before the settings existed when a game has none', () => {
    expect(ScoringHelper.complete(undefined)).toEqual({doubleAnswer: 'double', wrongAnswer: 'questionPoints'});
    expect(ScoringHelper.complete({doubleAnswer: 'none'})).toEqual({doubleAnswer: 'none', wrongAnswer: 'questionPoints'});
  });

  it('starts new games without a double grade or deduction', () => {
    expect(ScoringHelper.NEW_GAME_SCORING).toEqual({doubleAnswer: 'none', wrongAnswer: 'none'});
    expect(ScoringHelper.isAllowed(EGradeResults.DOUBLE, ScoringHelper.NEW_GAME_SCORING)).toBeFalse();
    expect(ScoringHelper.getPointsChange(EGradeResults.WRONG, 3, ScoringHelper.NEW_GAME_SCORING)).toBe(0);
  });

  it('awards the points of the question for a correct answer', () => {
    expect(ScoringHelper.getPointsChange(EGradeResults.CORRECT, 3, {doubleAnswer: 'plusOne', wrongAnswer: 'none'})).toBe(3);
  });

  it('awards twice the points, or one more, for a double answer', () => {
    expect(ScoringHelper.getPointsChange(EGradeResults.DOUBLE, 3, {doubleAnswer: 'double'})).toBe(6);
    expect(ScoringHelper.getPointsChange(EGradeResults.DOUBLE, 3, {doubleAnswer: 'plusOne'})).toBe(4);
  });

  it('deducts the points of the question, one point or nothing for a wrong answer', () => {
    expect(ScoringHelper.getPointsChange(EGradeResults.WRONG, 3, {wrongAnswer: 'questionPoints'})).toBe(-3);
    expect(ScoringHelper.getPointsChange(EGradeResults.WRONG, 3, {wrongAnswer: 'one'})).toBe(-1);
    expect(ScoringHelper.getPointsChange(EGradeResults.WRONG, 3, {wrongAnswer: 'none'})).toBe(0);
  });

  it('allows a double grade only in games that have it', () => {
    expect(ScoringHelper.isAllowed(EGradeResults.DOUBLE, undefined)).toBeTrue();
    expect(ScoringHelper.isAllowed(EGradeResults.DOUBLE, {doubleAnswer: 'plusOne'})).toBeTrue();
    expect(ScoringHelper.isAllowed(EGradeResults.DOUBLE, {doubleAnswer: 'none'})).toBeFalse();
    expect(ScoringHelper.isAllowed(EGradeResults.WRONG, {doubleAnswer: 'none'})).toBeTrue();
  });

  it('accepts only known settings', () => {
    expect(ScoringHelper.isValid({doubleAnswer: 'plusOne', wrongAnswer: 'one'})).toBeTrue();
    expect(ScoringHelper.isValid({})).toBeTrue();
    expect(ScoringHelper.isValid({doubleAnswer: 'triple'})).toBeFalse();
    expect(ScoringHelper.isValid({wrongAnswer: true})).toBeFalse();
    expect(ScoringHelper.isValid({other: 'none'})).toBeFalse();
    expect(ScoringHelper.isValid([])).toBeFalse();
  });
});
