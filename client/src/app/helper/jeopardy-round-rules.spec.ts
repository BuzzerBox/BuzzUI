import {EGradeResults, FinalRoundRules, GameFormatHelper, IFinalRound, IJeopardyRound, IQuestion, JeopardyRoundRules, PacketHelper, WagerHelper} from '../../../../shared/shared';

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
    expect(start()).toEqual({playedQuestionIds: [], openQuestionId: null, pickingTeamId: null, wagers: {}, lockedOutTeamIds: []});
    expect(rules.getCurrentQuestion(round, start())).toBeUndefined();
    expect(rules.mayBuzz(round, start(), 'a', {})).toBeFalse();
  });

  it('opens a tile, which every team may buzz on and which is worth its value', () => {
    const progress = open('m2');
    expect(rules.getCurrentQuestion(round, progress).id).toBe('m2');
    expect(rules.getTile(round, 'm2')).toEqual(jasmine.objectContaining({categoryIndex: 1, valueIndex: 1, value: 200}));
    expect(rules.mayBuzz(round, progress, 'a', {})).toBeTrue();
    expect(rules.getGradePoints(round, progress, EGradeResults.CORRECT, 'a')).toBe(200);
    expect(rules.getGradePoints(round, progress, EGradeResults.WRONG, 'a')).toBe(-200);
    expect(rules.getGradePoints(round, progress, EGradeResults.DOUBLE, 'a')).toBe(400);
  });

  it('closes the tile on a correct answer, and the team picks next', () => {
    const afterWrong = rules.afterGrade(round, open('g1'), 'a', EGradeResults.WRONG);
    expect(afterWrong.playedQuestionIds).toEqual([]);
    const afterCorrect = rules.afterGrade(round, afterWrong, 'b', EGradeResults.CORRECT);
    expect(afterCorrect).toEqual({playedQuestionIds: ['g1'], openQuestionId: 'g1', pickingTeamId: 'b', wagers: {}, lockedOutTeamIds: ['a']});
    expect(rules.mayGrade(round, afterCorrect, 'a')).toBeFalse();
    // shown until the master goes back, but nobody buzzes any more
    expect(rules.mayBuzz(round, afterCorrect, 'a', {})).toBeFalse();
    const board = rules.applySelectQuestion(round, afterCorrect, PacketHelper.makeSelectQuestionPacket(null));
    expect(board.openQuestionId).toBeNull();
    expect(open('g1', board)).toBeNull();
  });

  it('locks out a team that answered wrong, unless the play allows another try', () => {
    const wrong = rules.afterGrade(round, open('g2'), 'a', EGradeResults.WRONG);
    expect(wrong.lockedOutTeamIds).toEqual(['a']);
    expect(rules.mayBuzz(round, wrong, 'a', {})).toBeFalse();
    expect(rules.mayBuzz(round, wrong, 'a', {oneTryPerTile: true})).toBeFalse();
    expect(rules.mayBuzz(round, wrong, 'a', {oneTryPerTile: false})).toBeTrue();
    expect(rules.mayBuzz(round, wrong, 'b', {})).toBeTrue();
    // only for this tile
    const next = rules.applySelectQuestion(round, rules.applySelectQuestion(round, wrong, PacketHelper.makeSelectQuestionPacket(null)),
      PacketHelper.makeSelectQuestionPacket('m1'));
    expect(rules.mayBuzz(round, next, 'a', {})).toBeTrue();
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
      .toEqual({playedQuestionIds: ['g1'], openQuestionId: null, pickingTeamId: 'a', wagers: {}, lockedOutTeamIds: []});
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

  describe('Daily Double', () => {
    const board: IJeopardyRound = {...round, dailyDoubleQuestionIds: ['m1']};
    const opened = () => rules.applySelectQuestion(board, {...rules.completeProgress(board, undefined), pickingTeamId: 'a'},
      PacketHelper.makeSelectQuestionPacket('m1'));

    it('is answered by the team that picked it, after it wagered', () => {
      const progress = opened();
      expect(rules.mayBuzz(board, progress, 'a', {})).toBeFalse();
      expect(rules.mayGrade(board, progress, 'a')).toBeFalse();
      const wagered = rules.applySetWager(board, progress, 'a', 150, 50);
      expect(wagered.wagers).toEqual({a: 150});
      expect(rules.mayGrade(board, wagered, 'a')).toBeTrue();
      expect(rules.mayGrade(board, wagered, 'b')).toBeFalse();
      expect(rules.getGradePoints(board, wagered, EGradeResults.CORRECT, 'a')).toBe(150);
      expect(rules.getGradePoints(board, wagered, EGradeResults.WRONG, 'a')).toBe(-150);
      // a wrong answer closes it too, and the team picks again
      expect(rules.afterGrade(board, wagered, 'a', EGradeResults.WRONG)).toEqual(jasmine.objectContaining({playedQuestionIds: ['m1'], pickingTeamId: 'a'}));
    });

    it('takes wagers up to the points, or up to the highest value of the board', () => {
      expect(rules.getMaxWager(board, 50)).toBe(200);
      expect(rules.getMaxWager(board, 900)).toBe(900);
      expect(rules.getMaxWager(board, -300)).toBe(200);
      expect(rules.applySetWager(board, opened(), 'a', 5000, 50).wagers.a).toBe(200);
      expect(rules.applySetWager(board, opened(), 'a', -5, 50).wagers.a).toBe(0);
      expect(rules.applySetWager(board, opened(), 'b', 100, 50)).toBeNull();
      expect(rules.applySetWager(board, opened(), 'a', 'viel', 50)).toBeNull();
      // other tiles take no wagers
      expect(rules.applySetWager(board, open('g1'), 'a', 100, 50)).toBeNull();
    });

    it('forgets the wager when the board is shown again', () => {
      const wagered = rules.applySetWager(board, opened(), 'a', 100, 50);
      expect(rules.applySelectQuestion(board, wagered, PacketHelper.makeSelectQuestionPacket(null)).wagers).toEqual({});
    });
  });
});

describe('FinalRoundRules', () => {
  const rules = new FinalRoundRules();
  const final: IFinalRound = GameFormatHelper.makeFinalRound('f', 'Finale', 'Weltraum', {id: 'q', text: 'Wie heißt der rote Planet?', answers: [], show: false});
  const start = () => rules.completeProgress(final, undefined);

  it('shows the category first, and the question once the master shows it', () => {
    expect(rules.getCurrentQuestion(final, start())).toBeUndefined();
    expect(rules.isOver(final, start())).toBeFalse();
    const shown = rules.applySelectQuestion(final, start(), PacketHelper.makeSelectQuestionPacket('q'));
    expect(rules.getCurrentQuestion(final, shown).id).toBe('q');
    expect(rules.applySelectQuestion(final, start(), PacketHelper.makeSelectQuestionPacket('x'))).toBeNull();
    // no more wagers once the question is shown
    expect(rules.applySetWager(final, shown, 'a', 10, 100)).toBeNull();
  });

  it('grades every team once for its wager, nobody buzzes', () => {
    let progress = rules.applySetWager(final, start(), 'a', 300, 500);
    progress = rules.applySetWager(final, progress, 'b', 900, 400);
    expect(progress.wagers).toEqual({a: 300, b: 400});
    expect(rules.applySetWager(final, progress, 'c', 50, -20).wagers.c).toBe(0);
    expect(rules.mayGrade(final, progress, 'a')).toBeFalse();
    progress = rules.applySelectQuestion(final, progress, PacketHelper.makeSelectQuestionPacket('q'));
    expect(rules.mayBuzz(final, progress, 'a', {})).toBeFalse();
    expect(rules.getGradePoints(final, progress, EGradeResults.CORRECT, 'a')).toBe(300);
    expect(rules.getGradePoints(final, progress, EGradeResults.WRONG, 'b')).toBe(-400);
    progress = rules.afterGrade(final, progress, 'a', EGradeResults.CORRECT);
    expect(rules.mayGrade(final, progress, 'a')).toBeFalse();
    expect(rules.mayGrade(final, progress, 'b')).toBeTrue();
  });

  it('is read from files with its category and question', () => {
    expect(GameFormatHelper.checkRounds([final])).not.toBeNull();
    expect(GameFormatHelper.checkRounds([{...final, category: undefined}])).toBeNull();
    expect(GameFormatHelper.getAllQuestions(GameFormatHelper.checkRounds([{...final, question: {text: 'x'}}]))[0].id).toBe('f-question-1');
    expect(rules.completeProgress(final, {questionShown: true, wagers: {a: 5, b: 'x'} as never, gradeResults: {a: EGradeResults.WRONG}}))
      .toEqual({questionShown: true, wagers: {a: 5}, gradeResults: {a: EGradeResults.WRONG}});
  });

  it('keeps wagers whole and within bounds', () => {
    expect(WagerHelper.clamp('12.6', 100)).toBe(13);
    expect(WagerHelper.clamp('', 100)).toBeNull();
    expect(WagerHelper.clamp(50, -10)).toBe(0);
  });
});
