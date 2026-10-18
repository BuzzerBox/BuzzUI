import {
  ClassicRoundRules,
  CURRENT_GAME_FORMAT_VERSION,
  EGradeResults,
  EMediaStates,
  EQuestionAnswerStates,
  GameFormatHelper,
  IClassicRound,
  IGameState,
  IQuestion,
  PacketHelper
} from '../../../../shared/shared';
import {GameFileHelper} from './game-file.helper';

describe('GameFormatHelper', () => {
  const question = (text: string, id?: string, points?: number): IQuestion =>
    ({id, text, answers: [], show: false, points} as IQuestion);
  const legacyVersion = (questions: IQuestion[]) =>
    ({formatVersion: 4, kind: 'game', version: 3, savedAt: '2026-01-01T00:00:00.000Z', questions});
  const gameState = (extra: object): IGameState => ({
    markedTeamIds: [],
    loggedAnswers: [],
    activatedAnswers: [],
    setBuzzerLock: false,
    mediaQuestionState: {mediaState: EMediaStates.NO_MEDIA, questionState: EQuestionAnswerStates.SHOWN, answerState: EQuestionAnswerStates.WAIT_FOR_MEDIA},
    mediaVolume: PacketHelper.getDefaultMediaVolume(),
    ...extra
  } as IGameState);

  it('turns a version from before rounds into one classic round, with the same IDs every time', () => {
    const legacy = legacyVersion([question('A'), question('B')]);
    const migrated = GameFormatHelper.migrateDefinition(legacy);
    expect(migrated.formatVersion).toBe(CURRENT_GAME_FORMAT_VERSION);
    expect(migrated.version).toBe(3);
    expect((migrated as unknown as {questions?: unknown}).questions).toBeUndefined();
    expect(migrated.rounds.length).toBe(1);
    const round = migrated.rounds[0] as IClassicRound;
    expect(round.mode).toBe('classic');
    expect(round.id).toBe(GameFormatHelper.LEGACY_ROUND_ID);
    expect(round.questions.map(q => q.text)).toEqual(['A', 'B']);
    expect(round.questions.map(q => q.id)).toEqual(['question-1', 'question-2']);
    expect(GameFormatHelper.migrateDefinition(legacy)).toEqual(migrated);
    // the file as it was read stays as it is
    expect(legacy.questions[0].id).toBeUndefined();
  });

  it('keeps the IDs of a current version, and gives missing and doubled ones new ones', () => {
    const migrated = GameFormatHelper.migrateDefinition({
      formatVersion: 5, kind: 'game', version: 1, savedAt: '',
      rounds: [
        {id: 'r', mode: 'classic', name: 'Eins', questions: [question('A', 'x'), question('B'), question('C', 'x')]},
        {id: 'r', mode: 'classic', name: '', questions: []}
      ]
    });
    expect(migrated.rounds.map(round => round.id)).toEqual(['r', 'round-2']);
    expect(migrated.rounds.map(round => round.name)).toEqual(['Eins', 'Runde 2']);
    const ids = GameFormatHelper.getAllQuestions([migrated.rounds[0]]).map(q => q.id);
    expect(ids[0]).toBe('x');
    expect(new Set(ids).size).toBe(3);
  });

  it('refuses what is no game, or has rounds it can not play', () => {
    expect(GameFormatHelper.migrateDefinition(null)).toBeNull();
    expect(GameFormatHelper.migrateDefinition({kind: 'state'})).toBeNull();
    expect(GameFormatHelper.migrateDefinition({kind: 'game'})).toBeNull();
    expect(GameFormatHelper.migrateDefinition({kind: 'game', rounds: [{id: 'j', mode: 'jeopardy', name: 'J', categories: []}]})).toBeNull();
  });

  it('puts a state from before rounds on the question it was at', () => {
    const rounds = GameFormatHelper.migrateDefinition(legacyVersion([question('A'), question('B'), question('C')])).rounds;
    const migrated = GameFormatHelper.migrateGameState(gameState({currentQuestionNumber: 2}), rounds);
    expect((migrated as unknown as {currentQuestionNumber?: number}).currentQuestionNumber).toBeUndefined();
    expect(migrated.currentRoundId).toBe(GameFormatHelper.LEGACY_ROUND_ID);
    expect(GameFormatHelper.getCurrentQuestion(rounds, migrated).text).toBe('C');
    expect(GameFormatHelper.getProgress(rounds, migrated)).toEqual({roundNumber: 1, roundCount: 1, questionNumber: 3, questionCount: 3});
  });

  it('starts over what does not fit the rounds', () => {
    const rounds: IClassicRound[] = [
      GameFormatHelper.makeClassicRound('r1', 'Runde 1', [question('A', 'a'), question('B', 'b')]),
      GameFormatHelper.makeClassicRound('r2', 'Runde 2', [question('C', 'c')])
    ];
    const completed = GameFormatHelper.completeGameState(gameState({currentRoundId: 'gone', roundProgress: {r2: {currentQuestionId: 'gone'}}}), rounds);
    expect(completed.currentRoundId).toBe('r1');
    expect(completed.roundProgress).toEqual({r1: {currentQuestionId: 'a'}, r2: {currentQuestionId: 'c'}});
  });

  it('describes where a game is', () => {
    expect(GameFormatHelper.describeProgress({roundNumber: 1, roundCount: 1, questionNumber: 4, questionCount: 10})).toBe('Frage 4 von 10');
    expect(GameFormatHelper.describeProgress({roundNumber: 2, roundCount: 3, questionNumber: 1, questionCount: 5})).toBe('Runde 2 von 3, Frage 1 von 5');
  });

  it('migrates bundles and old savegames when they are imported', () => {
    const bundle = GameFileHelper.toBundle({
      formatVersion: 4, kind: 'bundle', gameName: 'Quiz', game: legacyVersion([question('A'), question('B')]),
      state: {formatVersion: 4, kind: 'state', gameVersion: 3, createdAt: '', updatedAt: '', finished: false, teams: [], gameState: gameState({currentQuestionNumber: 1})}
    }, 'quiz.json');
    expect(GameFormatHelper.getAllQuestions(bundle.game.rounds).length).toBe(2);
    expect(bundle.state.gameState.roundProgress[GameFormatHelper.LEGACY_ROUND_ID]).toEqual({currentQuestionId: 'question-2'});

    const saveGame = GameFileHelper.toBundle({version: 3, teams: [], question: [question('A')], gameState: gameState({currentQuestionNumber: 0})}, 'alt.json');
    expect(GameFormatHelper.getAllQuestions(saveGame.game.rounds)[0].id).toBe('question-1');
    expect(saveGame.state.gameState.currentRoundId).toBe(GameFormatHelper.LEGACY_ROUND_ID);
  });
});

describe('ClassicRoundRules', () => {
  const rules = new ClassicRoundRules();
  const round = GameFormatHelper.makeClassicRound('r', 'Runde 1', [
    {id: 'a', text: 'A', answers: [], show: false},
    {id: 'b', text: 'B', answers: [], show: false, points: 3}
  ]);

  it('goes through the questions one after the other, and is over at the last one', () => {
    const start = rules.completeProgress(round, undefined);
    expect(rules.getCurrentQuestion(round, start).id).toBe('a');
    expect(rules.hasPreviousQuestion(round, start)).toBeFalse();
    expect(rules.isOver(round, start)).toBeFalse();
    const last = rules.selectQuestion(round, start, 1);
    expect(rules.getCurrentQuestion(round, last).id).toBe('b');
    expect(rules.hasNextQuestion(round, last)).toBeFalse();
    expect(rules.isOver(round, last)).toBeTrue();
    expect(rules.selectQuestion(round, last, 2)).toBeNull();
  });

  it('scores the points of the question, as games did before rounds', () => {
    const first = rules.completeProgress(round, undefined);
    const second = rules.selectQuestion(round, first, 1);
    expect(rules.getGradePoints(round, first, EGradeResults.CORRECT, 'team')).toBe(1);
    expect(rules.getGradePoints(round, second, EGradeResults.CORRECT, 'team')).toBe(3);
    expect(rules.getGradePoints(round, second, EGradeResults.DOUBLE, 'team')).toBe(6);
    expect(rules.getGradePoints(round, second, EGradeResults.WRONG, 'team')).toBe(-3);
    expect(rules.mayBuzz(round, second, 'team', {})).toBeTrue();
  });
});
