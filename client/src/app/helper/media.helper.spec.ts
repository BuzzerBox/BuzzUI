import {EMediaStates, EQuestionAnswerStates, GameFormatHelper, IMediaQuestionState, IQuestion, IRound, MediaHelper} from '../../../../shared/shared';

describe('MediaHelper media defaults', () => {
  const hideBoth: IMediaQuestionState = {mediaState: EMediaStates.PAUSED, questionState: EQuestionAnswerStates.HIDDEN, answerState: EQuestionAnswerStates.HIDDEN};
  const showAnswers: IMediaQuestionState = {mediaState: EMediaStates.PAUSED, questionState: EQuestionAnswerStates.SHOWN, answerState: EQuestionAnswerStates.SHOWN};

  const question = (fileSrc?: string, slides?: string[], initialConfig?: IMediaQuestionState): IQuestion => ({
    id: 'q', text: 'Q', answers: [], show: true, mediaDetails: fileSrc ? {fileSrc, slides} : undefined, initialConfig
  });
  const round = (questions: IQuestion[]): IRound => GameFormatHelper.makeClassicRound('r', 'Runde 1', questions);

  it('tells the kind of media', () => {
    expect(MediaHelper.getMediaKind(undefined)).toBeNull();
    expect(MediaHelper.getMediaKind({fileSrc: ''})).toBeNull();
    expect(MediaHelper.getMediaKind({fileSrc: 'a.png'})).toBe('image');
    expect(MediaHelper.getMediaKind({fileSrc: 'a.mp4'})).toBe('playable');
    expect(MediaHelper.getMediaKind({fileSrc: 'a.mp3'})).toBe('playable');
    expect(MediaHelper.getMediaKind({fileSrc: 'folder', slides: ['folder/1.png']})).toBe('slideshow');
  });

  it('starts questions as the game default for their kind of media says, unless they have their own config', () => {
    const questions = [question(), question('a.png'), question('a.mp4'), question('s', ['s/1.png']), question('b.mp4', undefined, showAnswers)];
    const played = GameFormatHelper.getAllQuestions(MediaHelper.applyMediaDefaults([round(questions)], {image: hideBoth, playable: showAnswers, slideshow: hideBoth}));
    expect(played[0].initialConfig).toBeUndefined();
    expect(played[1].initialConfig).toEqual(hideBoth);
    expect(played[2].initialConfig).toEqual(showAnswers);
    expect(played[3].initialConfig).toEqual(hideBoth);
    expect(played[4].initialConfig).toEqual(showAnswers);
    // the stored questions stay as they are
    expect(questions[1].initialConfig).toBeUndefined();
  });

  it('falls back to the built-in default for kinds the game does not set', () => {
    const played = GameFormatHelper.getAllQuestions(MediaHelper.applyMediaDefaults([round([question('a.png')])], {playable: hideBoth}));
    expect(played[0].initialConfig).toEqual(MediaHelper.getDefaultInitialConfig());
  });

  it('finds the missing media of every round', () => {
    const rounds = [round([question('a.png'), question('b.png')]), {...round([question('s', ['s/1.png', 's/2.png'])]), id: 'r2'}];
    expect(MediaHelper.findMissingMedia(rounds, new Set(['a.png', 's', 's/1.png']))).toEqual([
      {roundNumber: 1, questionNumber: 2, path: 'b.png'},
      {roundNumber: 2, questionNumber: 1, path: 's/2.png'}
    ]);
  });
});
