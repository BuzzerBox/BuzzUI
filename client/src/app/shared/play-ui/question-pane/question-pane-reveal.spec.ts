import {Subject} from 'rxjs';
import {EQuestionAnswerStates, IQuestion} from '../../../../../../shared/shared';
import {GameService} from '../../../services/game.service';
import {QuestionPaneComponent} from './question-pane.component';
import {MatDialog} from '@angular/material/dialog';
import {MatBottomSheet} from '@angular/material/bottom-sheet';
import {IDialogConfirmData} from '../../dialog-confirm/dialog-confirm.component';

// the master taps the question or the answers where they are shown hidden, and is asked whether to reveal them
describe('QuestionPaneComponent reveal on tap', () => {
  let game: jasmine.SpyObj<GameService>;
  let dialog: {open: jasmine.Spy};
  let bottomSheets: {open: jasmine.Spy};
  let closed: Subject<boolean>;
  let component: QuestionPaneComponent;

  const question: IQuestion = {text: 'Wer singt das?', answers: [{text: 'A', isCorrect: true}], show: true, mediaDetails: {fileSrc: 'clip.mp4'}};

  beforeEach(() => {
    game = jasmine.createSpyObj<GameService>('GameService', ['changeMediaState']);
    closed = new Subject<boolean>();
    dialog = {open: jasmine.createSpy('open').and.callFake(() => ({afterClosed: () => closed, close: jasmine.createSpy('close')}))};
    bottomSheets = {open: jasmine.createSpy('open')};
    component = new QuestionPaneComponent(game, bottomSheets as unknown as MatBottomSheet, null, dialog as unknown as MatDialog);
    component.isMaster = true;
    component.question = question;
    component.showQuestion = false;
    component.showAnswers = false;
    setStates(EQuestionAnswerStates.HIDDEN, EQuestionAnswerStates.HIDDEN);
  });

  // they come from the media state packets
  function setStates(questionState: EQuestionAnswerStates, answerState: EQuestionAnswerStates): void {
    Object.assign(component, {questionState, answerState});
  }

  const asked = (): IDialogConfirmData => dialog.open.calls.mostRecent().args[1].data;

  it('reveals the hidden question once confirmed', () => {
    component.askToRevealQuestion();
    expect(asked().title).toBe('Frage zeigen?');
    closed.next(true);
    expect(game.changeMediaState).toHaveBeenCalledOnceWith({questionState: EQuestionAnswerStates.SHOWN});
  });

  it('leaves it hidden when cancelled', () => {
    component.askToRevealQuestion();
    closed.next(false);
    expect(game.changeMediaState).not.toHaveBeenCalled();
  });

  it('reveals the hidden answers once confirmed', () => {
    expect(component.canRevealAnswers()).toBeTrue();
    component.askToRevealAnswers();
    expect(asked().title).toBe('Antworten zeigen?');
    closed.next(true);
    expect(game.changeMediaState).toHaveBeenCalledOnceWith({answerState: EQuestionAnswerStates.SHOWN});
  });

  it('offers nothing for a single hidden answer; the tap belongs to the outline around them', () => {
    component.onClickAnswer(question.answers[0], null);
    expect(bottomSheets.open).not.toHaveBeenCalled();
    expect(dialog.open).not.toHaveBeenCalled();
  });

  it("can't reveal answers that are shown", () => {
    component.showAnswers = true;
    expect(component.canRevealAnswers()).toBeFalse();
    component.askToRevealAnswers();
    expect(dialog.open).not.toHaveBeenCalled();
  });

  it('says when the part would appear by itself', () => {
    setStates(EQuestionAnswerStates.WAIT_FOR_MEDIA, EQuestionAnswerStates.HIDDEN);
    component.askToRevealQuestion();
    expect(asked().message).toBe('Die Frage erscheint dann auf der Anzeige. Sonst erscheint sie nach dem Video.');
  });

  it('asks only once at a time', () => {
    component.askToRevealQuestion();
    component.askToRevealQuestion();
    expect(dialog.open).toHaveBeenCalledTimes(1);
  });

  it("doesn't ask about a visible question", () => {
    component.showQuestion = true;
    component.askToRevealQuestion();
    expect(dialog.open).not.toHaveBeenCalled();
  });

  it("doesn't reveal after the question changed meanwhile", () => {
    component.askToRevealQuestion();
    component.question = {...question, text: 'Nächste'};
    closed.next(true);
    expect(game.changeMediaState).not.toHaveBeenCalled();
  });
});
