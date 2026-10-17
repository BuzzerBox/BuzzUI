import {EMediaStates, EQuestionAnswerStates, IMediaQuestionState, IQuestion, MediaHelper} from '../../../../shared/shared';

describe('MediaHelper media defaults', () => {
  const hideBoth: IMediaQuestionState = {mediaState: EMediaStates.PAUSED, questionState: EQuestionAnswerStates.HIDDEN, answerState: EQuestionAnswerStates.HIDDEN};
  const showAnswers: IMediaQuestionState = {mediaState: EMediaStates.PAUSED, questionState: EQuestionAnswerStates.SHOWN, answerState: EQuestionAnswerStates.SHOWN};

  const question = (fileSrc?: string, slides?: string[], initialConfig?: IMediaQuestionState): IQuestion => ({
    text: 'Q', answers: [], show: true, mediaDetails: fileSrc ? {fileSrc, slides} : undefined, initialConfig
  });

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
    const played = MediaHelper.applyMediaDefaults(questions, {image: hideBoth, playable: showAnswers, slideshow: hideBoth});
    expect(played[0].initialConfig).toBeUndefined();
    expect(played[1].initialConfig).toEqual(hideBoth);
    expect(played[2].initialConfig).toEqual(showAnswers);
    expect(played[3].initialConfig).toEqual(hideBoth);
    expect(played[4].initialConfig).toEqual(showAnswers);
    // the stored questions stay as they are
    expect(questions[1].initialConfig).toBeUndefined();
  });

  it('falls back to the built-in default for kinds the game does not set', () => {
    const played = MediaHelper.applyMediaDefaults([question('a.png')], {playable: hideBoth});
    expect(played[0].initialConfig).toEqual(MediaHelper.getDefaultInitialConfig());
  });
});
