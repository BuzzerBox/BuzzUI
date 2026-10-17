import {EGradeResults, GameFormatHelper, IJeopardyRound, IQuestion, JeopardyRoundRules, PacketHelper} from '../../../../shared/shared';

describe('JeopardyRoundRules', () => {
  const rules = new JeopardyRoundRules();
  const question = (id: string): IQuestion => ({id, text: id, answers: [], show: false});
  const round: IJeopardyRound = GameFormatHelper.makeJeopardyRound('j', 'Jeopardy', [100, 200], [
    {name: 'Geografie', questions: [question('g1'), question('g2')]},
    {name: 'Musik', questions: [question('m1'), question('m2')]}
  ]);
  const start = () => rules.completeProgress(round, undefined);
  const open = (id: string, progress = start()) => rules.applySelectQuestion(round, progress, PacketHelper.makeSelectQuestionPacket(id));

  it('starts with the board and nobody picking', () => {
    expect(start()).toEqual({playedQuestionIds: [], openQuestionId: null, pickingTeamId: null});
    expect(rules.getCurrentQuestion(round, start())).toBeUndefined();
    expect(rules.mayBuzz(round, start(), 'a')).toBeFalse();
  });

  it('opens a tile, which every team may buzz on and which is worth its value', () => {
    const progress = open('m2');
    expect(rules.getCurrentQuestion(round, progress).id).toBe('m2');
    expect(rules.getTile(round, 'm2')).toEqual(jasmine.objectContaining({categoryIndex: 1, valueIndex: 1, value: 200}));
    expect(rules.mayBuzz(round, progress, 'a')).toBeTrue();
    expect(rules.getGradePoints(round, progress, EGradeResults.CORRECT)).toBe(200);
    expect(rules.getGradePoints(round, progress, EGradeResults.WRONG)).toBe(-200);
    expect(rules.getGradePoints(round, progress, EGradeResults.DOUBLE)).toBe(400);
  });

  it('closes the tile on a correct answer, and the team picks next', () => {
    const afterWrong = rules.afterGrade(round, open('g1'), 'a', EGradeResults.WRONG);
    expect(afterWrong.playedQuestionIds).toEqual([]);
    const afterCorrect = rules.afterGrade(round, afterWrong, 'b', EGradeResults.CORRECT);
    expect(afterCorrect).toEqual({playedQuestionIds: ['g1'], openQuestionId: 'g1', pickingTeamId: 'b'});
    // shown until the master goes back, but nobody buzzes any more
    expect(rules.mayBuzz(round, afterCorrect, 'a')).toBeFalse();
    const board = rules.applySelectQuestion(round, afterCorrect, PacketHelper.makeSelectQuestionPacket(null));
    expect(board.openQuestionId).toBeNull();
    expect(open('g1', board)).toBeNull();
  });

  it('closes a tile without points, or keeps it for later', () => {
    const kept = rules.applySelectQuestion(round, open('g2'), PacketHelper.makeSelectQuestionPacket(null, false));
    expect(kept.playedQuestionIds).toEqual([]);
    const closed = rules.applySelectQuestion(round, open('g2'), PacketHelper.makeSelectQuestionPacket(null, true));
    expect(closed.playedQuestionIds).toEqual(['g2']);
    expect(open('nope')).toBeNull();
  });

  it('is over when every tile is played and the board is shown', () => {
    let progress = start();
    for (const id of ['g1', 'g2', 'm1', 'm2']) {
      expect(rules.isOver(round, progress)).toBeFalse();
      progress = rules.applySelectQuestion(round, open(id, progress), PacketHelper.makeSelectQuestionPacket(null, true));
    }
    expect(rules.isOver(round, progress)).toBeTrue();
    expect(rules.hasNextQuestion(round, progress)).toBeFalse();
  });

  it('keeps what a state saved only if it fits the board', () => {
    expect(rules.completeProgress(round, {playedQuestionIds: ['g1', 'x', 'g1'], openQuestionId: 'x', pickingTeamId: 'a'}))
      .toEqual({playedQuestionIds: ['g1'], openQuestionId: null, pickingTeamId: 'a'});
    expect(rules.applySetPickingTeam(start(), 'c').pickingTeamId).toBe('c');
  });

  it('is read from files only with a question for every value of every category', () => {
    expect(GameFormatHelper.checkRounds([round])).not.toBeNull();
    expect(GameFormatHelper.checkRounds([{...round, values: [100]}])).toBeNull();
    expect(GameFormatHelper.checkRounds([{...round, values: [100, 'x']}])).toBeNull();
    const withoutIds = {...round, categories: [{name: 'A', questions: [{text: 'a'}, {text: 'b'}]}]};
    const ids = GameFormatHelper.getAllQuestions(GameFormatHelper.checkRounds([withoutIds])).map(q => q.id);
    expect(ids).toEqual(['j-question-1', 'j-question-2']);
  });
});
