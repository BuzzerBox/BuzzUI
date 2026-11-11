import {TestBed} from '@angular/core/testing';
import {provideZoneChangeDetection} from '@angular/core';
import {MatDialog, MatDialogModule} from '@angular/material/dialog';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';

import {DialogGradeAnswerComponent, IDialogGradeAnswerData, RELEASE_WITHOUT_GRADE, TGradeDialogResult} from './dialog-grade-answer.component';
import {DialogConfirmComponent} from '../../../dialog-confirm/dialog-confirm.component';
import {IScoring} from '../../../../../../../shared/shared';

describe('DialogGradeAnswerComponent', () => {
  let dialog: MatDialog;
  let scoring: IScoring;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DialogGradeAnswerComponent, DialogConfirmComponent],
      imports: [MatDialogModule, MatButtonModule, MatIconModule],
      providers: [provideZoneChangeDetection()]
    }).compileComponents();
    dialog = TestBed.inject(MatDialog);
    scoring = {doubleAnswer: 'double', wrongAnswer: 'questionPoints'};
    answers = [];
  });

  afterEach(() => dialog.closeAll());

  // the dialog's close animation ends asynchronously
  const settle = () => new Promise(resolve => setTimeout(resolve, 200));

  // the answer options the dialog shows; none unless a test sets them
  let answers: IDialogGradeAnswerData['answers'] = [];

  // the question the dialog repeats; none unless a test sets it
  let questionText: string | undefined;
  beforeEach(() => questionText = undefined);

  async function open(): Promise<{closed: jasmine.Spy, element: HTMLElement, close: (result?: TGradeDialogResult) => void}> {
    const dialogRef = dialog.open<DialogGradeAnswerComponent, IDialogGradeAnswerData, TGradeDialogResult>(DialogGradeAnswerComponent, {
      disableClose: true,
      data: {teamName: 'Team A', questionText, points: 1, answers, answersHiddenOnScreens: false, scoring}
    });
    const closed = jasmine.createSpy('closed');
    dialogRef.afterClosed().subscribe(closed);
    await settle();
    return {closed, element: document.querySelector('app-dialog-grade-answer') as HTMLElement, close: result => dialogRef.close(result)};
  }

  const confirmation = (): HTMLElement => document.querySelector('app-dialog-confirm');

  function findButton(element: HTMLElement, text: string): HTMLButtonElement {
    return Array.from(element.querySelectorAll('button')).find(b => b.textContent.trim() === text) as HTMLButtonElement;
  }

  it('repeats the question, which it may cover on a small screen', async () => {
    questionText = 'Wie hoch ist die Zugspitze?';
    const {element} = await open();
    expect(element.querySelector('.question').textContent.trim()).toBe('Wie hoch ist die Zugspitze?');
  });

  it('shows no question box without a question text', async () => {
    const {element} = await open();
    expect(element.querySelector('.question')).toBeNull();
  });

  it('closes without a grade with the X', async () => {
    const {closed, element} = await open();
    const close = element.querySelector('button.close') as HTMLButtonElement;
    expect(close.getAttribute('aria-label')).toBe('Schließen');
    close.click();
    await settle();
    expect(closed).toHaveBeenCalledOnceWith(undefined);
  });

  // click() above skips hit testing; a tap or click goes to whatever is on top at that point
  it('has nothing on top of the X', async () => {
    const {element} = await open();
    const close = element.querySelector('button.close') as HTMLButtonElement;
    const box = close.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    expect(close.contains(hit)).withContext(`hit ${hit?.tagName}.${hit?.className}`).toBeTrue();
  });

  it('closes without a grade with "Später bewerten"', async () => {
    const {closed, element} = await open();
    findButton(element, 'Später bewerten').click();
    await settle();
    expect(closed).toHaveBeenCalledOnceWith(undefined);
  });

  it('releases without a grade once confirmed', async () => {
    const {closed, element} = await open();
    findButton(element, 'Ohne Wertung freigeben').click();
    await settle();
    expect(closed).not.toHaveBeenCalled();
    expect(confirmation().textContent).toContain('Team A');
    findButton(confirmation(), 'Freigeben').click();
    await settle();
    expect(closed).toHaveBeenCalledOnceWith(RELEASE_WITHOUT_GRADE);
  });

  it('goes back to grading when the release is cancelled', async () => {
    const {closed, element} = await open();
    findButton(element, 'Ohne Wertung freigeben').click();
    await settle();
    findButton(confirmation(), 'Abbrechen').click();
    await settle();
    expect(confirmation()).toBeNull();
    expect(closed).not.toHaveBeenCalled();
    expect(document.querySelector('app-dialog-grade-answer')).not.toBeNull();
  });

  it('drops the confirmation when it closes meanwhile', async () => {
    const {closed, element, close} = await open();
    findButton(element, 'Ohne Wertung freigeben').click();
    await settle();
    // as when the team is no longer marked
    close();
    await settle();
    expect(confirmation()).toBeNull();
    expect(closed).toHaveBeenCalledOnceWith(undefined);
  });

  it('offers double points and a deduction for a wrong answer by default', async () => {
    const {element} = await open();
    expect(findButton(element, 'Doppelt (+2 Punkte)')).toBeTruthy();
    expect(findButton(element, 'Falsch (−1 Punkt)')).toBeTruthy();
  });

  it('offers no double grade in a game without it', async () => {
    scoring = {doubleAnswer: 'none', wrongAnswer: 'questionPoints'};
    const {element} = await open();
    expect(element.querySelector('button.double')).toBeNull();
  });

  it('offers a bonus of one point in a game that has it', async () => {
    scoring = {doubleAnswer: 'plusOne', wrongAnswer: 'questionPoints'};
    const {element} = await open();
    expect(findButton(element, 'Bonus (+2 Punkte)')).toBeTruthy();
  });

  it('shows what a wrong answer costs', async () => {
    scoring = {doubleAnswer: 'double', wrongAnswer: 'one'};
    let {element} = await open();
    expect(findButton(element, 'Falsch (−1 Punkt)')).toBeTruthy();
    dialog.closeAll();
    scoring = {doubleAnswer: 'double', wrongAnswer: 'none'};
    ({element} = await open());
    expect((element.querySelector('button.wrong') as HTMLElement).textContent.trim()).toBe('Falsch');
  });

  it('shows the answer options as a choice, with the picked one checked', async () => {
    answers = [
      {answer: {text: 'Paris', isCorrect: true}, letter: 'A', isRevealed: false},
      {answer: {text: 'Lyon', isCorrect: false}, letter: 'B', isRevealed: false}
    ];
    const {element} = await open();
    expect(element.textContent).toContain('Tippe die Antwort an, die das Team gegeben hat');
    const icons = () => Array.from(element.querySelectorAll('.choice-icon')).map(icon => icon.textContent.trim());
    expect(icons()).toEqual(['radio_button_unchecked', 'radio_button_unchecked']);
    (element.querySelectorAll('button.answer-option')[1] as HTMLButtonElement).click();
    await settle();
    expect(icons()).toEqual(['radio_button_unchecked', 'radio_button_checked']);
    // picking it again unpicks it
    (element.querySelectorAll('button.answer-option')[1] as HTMLButtonElement).click();
    await settle();
    expect(icons()).toEqual(['radio_button_unchecked', 'radio_button_unchecked']);
  });

  it('aligns a correct answer\'s text on the left like the others, with only its check on the right', async () => {
    answers = [
      {answer: {text: 'Paris', isCorrect: true}, letter: 'A', isRevealed: false},
      {answer: {text: 'Lyon', isCorrect: false}, letter: 'B', isRevealed: false}
    ];
    const {element} = await open();
    const [correct, wrong] = Array.from(element.querySelectorAll('button.answer-option')) as HTMLElement[];
    const left = (button: HTMLElement, selector: string) =>
      button.querySelector(selector).getBoundingClientRect().left - button.getBoundingClientRect().left;
    expect(Math.abs(left(correct, '.text') - left(wrong, '.text'))).toBeLessThan(1);
    const check = correct.querySelector('.correct-icon').getBoundingClientRect();
    expect(correct.getBoundingClientRect().right - check.right).toBeLessThan(20);
  });

  it('makes the grade buttons equally wide', async () => {
    const {element} = await open();
    const widths = Array.from(element.querySelectorAll('.grade-actions button')).map(b => Math.round(b.getBoundingClientRect().width));
    expect(widths.length).toBe(3);
    expect(widths).toEqual([widths[0], widths[0], widths[0]]);
  });

  it('lines the grade buttons up with the answer options', async () => {
    answers = [
      {answer: {text: 'Paris', isCorrect: true}, letter: 'A', isRevealed: false},
      {answer: {text: 'Lyon', isCorrect: false}, letter: 'B', isRevealed: false}
    ];
    const {element} = await open();
    const options = Array.from(element.querySelectorAll('button.answer-option')).map(b => b.getBoundingClientRect());
    const grades = Array.from(element.querySelectorAll('.grade-actions button')).map(b => b.getBoundingClientRect());
    expect(Math.round(grades[0].left)).toBe(Math.round(options[0].left));
    expect(Math.round(grades[grades.length - 1].right)).toBe(Math.round(options[options.length - 1].right));
  });
});
