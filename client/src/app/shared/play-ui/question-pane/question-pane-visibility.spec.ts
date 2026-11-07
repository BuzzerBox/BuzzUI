import {EQuestionAnswerStates, IMediaDetails} from '../../../../../../shared/shared';
import {QuestionPaneComponent} from './question-pane.component';

// the master's buttons that show and hide the question, the answers and the media on the screens
describe('QuestionPaneComponent visibility labels', () => {
  const video: IMediaDetails = {fileSrc: 'clip.mp4'};
  const slideshow: IMediaDetails = {fileSrc: 'Bilder', slides: ['a.jpg', 'b.jpg']};
  const image: IMediaDetails = {fileSrc: 'bild.jpg'};
  const note = QuestionPaneComponent.getVisibilityNote;
  const title = QuestionPaneComponent.getVisibilityTitle;

  it('leaves the state to the icon and the action when the button toggles', () => {
    expect(note(true, EQuestionAnswerStates.SHOWN, video, true)).toBe('');
    expect(note(false, EQuestionAnswerStates.HIDDEN, video, true)).toBe('');
  });

  it('says briefly when a hidden part waits for the media', () => {
    expect(note(false, EQuestionAnswerStates.WAIT_FOR_MEDIA, video, true)).toBe(' · nach Video');
    expect(note(false, EQuestionAnswerStates.WAIT_FOR_MEDIA, slideshow, true)).toBe(' · nach Bildserie');
  });

  it('says nothing about waiting for media that has no end', () => {
    expect(note(false, EQuestionAnswerStates.WAIT_FOR_MEDIA, image, true)).toBe('');
  });

  it('says the state when the button has no action', () => {
    expect(note(true, EQuestionAnswerStates.SHOWN, undefined, false)).toBe(': sichtbar');
    expect(note(false, EQuestionAnswerStates.HIDDEN, undefined, false)).toBe(': verborgen');
  });

  it('keeps the whole sentence in the tooltip', () => {
    expect(title('Frage', true, EQuestionAnswerStates.SHOWN, video)).toBe('Frage auf der Anzeige verbergen');
    expect(title('Frage', false, EQuestionAnswerStates.HIDDEN, video)).toBe('Frage auf der Anzeige zeigen');
    expect(title('Antworten', false, EQuestionAnswerStates.WAIT_FOR_MEDIA, video))
      .toBe('Antworten auf der Anzeige zeigen; sonst erscheinen sie nach dem Video');
    expect(title('Frage', false, EQuestionAnswerStates.WAIT_FOR_MEDIA, slideshow))
      .toBe('Frage auf der Anzeige zeigen; sonst erscheint sie nach der Bildserie');
  });
});
