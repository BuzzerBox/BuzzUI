import {Component, Input, OnChanges, OnInit, SimpleChanges} from '@angular/core';
import {GameService} from '../../../services/game.service';
import {IAnswer, IQuestion} from '../../../../../../shared/objects/shared';
import {MatBottomSheet} from '@angular/material/bottom-sheet';
import {
  AnswerOptionsComponent,
  EDecisionBottomSheetAnswerOptions,
  IBottomSheetsAnswerOptionsData
} from '../bottom-sheets/answer-options/answer-options.component';
import {Subscription} from 'rxjs';
import {ArraysHelper} from '../../../helper/arrays.helper';
import {MatSnackBar, MatSnackBarRef, TextOnlySnackBar} from '@angular/material/snack-bar';

@Component({
  selector: 'app-question-pane',
  templateUrl: './question-pane.component.html',
  styleUrls: ['./question-pane.component.css']
})
export class QuestionPaneComponent implements OnInit, OnChanges {
  @Input() isMaster = false;
  @Input() question: IQuestion;

  private readonly STYLE_CLASS_ANSWER_LOGGED_IN = 'logged-in';
  private readonly STYLE_CLASS_ANSWER_CORRECT = 'correct';
  private readonly STYLE_CLASS_ANSWER_WRONG = 'wrong';

  private loggedInAnswers: IAnswer[];
  private activatedAnswers: IAnswer[];
  private correctAnswersThatAreLeft: number;
  private allCorrectAnswersFoundSnackBar: MatSnackBarRef<TextOnlySnackBar>;

  constructor(private game: GameService, private bottomSheets: MatBottomSheet, private snackBar: MatSnackBar) { }

  ngOnInit(): void {
    // Not needed here since ngOnChange is fired even upon the first instantiation
    // this.reset();
  }

  public reset(): void {
    this.loggedInAnswers = [];
    this.activatedAnswers = [];
    this.correctAnswersThatAreLeft = 0;
    for (const answer of this.question.answers) {
      if (answer.isCorrect) {
        this.correctAnswersThatAreLeft++;
      }
    }
    if (this.allCorrectAnswersFoundSnackBar != null) {
      this.allCorrectAnswersFoundSnackBar.dismiss();
      this.allCorrectAnswersFoundSnackBar = null;
    }
  }

  public getCurrentQuestionNumber(): number {
    return this.game.getCurrentQuestionNumber() + 1;
  }

  public getTotalQuestionNumber(): number {
    return this.game.getQuestions().length;
  }

  public getQuestionText(): string {
    return this.question.text;
  }

  public getAnswers(): IAnswer[] {
    return this.question.answers;
  }

  public onClickAnswer(answer, button: HTMLButtonElement): void {
    if (!this.isMaster || this.activatedAnswers.includes(answer) || this.correctAnswersThatAreLeft === 0) {
      return;
    }

    const bottomSheetRef = this.bottomSheets.open<any, IBottomSheetsAnswerOptionsData, EDecisionBottomSheetAnswerOptions>(AnswerOptionsComponent, {
      data: {
        isAnswerLoggedIn: this.loggedInAnswers.includes(answer)
      }
    });
    const sub: Subscription = bottomSheetRef.afterDismissed().subscribe(decision => {
      if (decision != null) {
        switch (decision) {
          case EDecisionBottomSheetAnswerOptions.ACTIVATE:
            this.activateAnswer(answer, button);
            break;
          case EDecisionBottomSheetAnswerOptions.LOG_IN:
            this.logInAnswer(answer, button);
            break;
          case EDecisionBottomSheetAnswerOptions.LOG_OUT:
            this.logOutAnswer(answer, button);
            break;
          case EDecisionBottomSheetAnswerOptions.NOTHING:
          default:
            break;
        }
      }

      sub.unsubscribe();
      button.blur();
    });
  }

  public logInAnswer(answer: IAnswer, button: HTMLButtonElement): void {
    button.classList.add(this.STYLE_CLASS_ANSWER_LOGGED_IN);
    this.loggedInAnswers.push(answer);
    this.game.logInAnswer(answer);
  }

  public logOutAnswer(answer: IAnswer, button: HTMLButtonElement): void {
    button.classList.remove(this.STYLE_CLASS_ANSWER_LOGGED_IN);
    ArraysHelper.remove<IAnswer>(this.loggedInAnswers, answer);
    this.game.logOutAnswer(answer);
  }

  public activateAnswer(answer: IAnswer, button: HTMLButtonElement): void {
    button.classList.remove(this.STYLE_CLASS_ANSWER_LOGGED_IN);
    ArraysHelper.remove<IAnswer>(this.loggedInAnswers, answer);
    let style: string;
    if (answer.isCorrect) {
      style = this.STYLE_CLASS_ANSWER_CORRECT;
      this.correctAnswersThatAreLeft--;
      if (this.correctAnswersThatAreLeft === 0 && this.isMaster) {
        this.allCorrectAnswersFoundSnackBar = this.snackBar.open('Alle richtigen Antworten wurden aufgedeckt.', 'Okay');
        const sub: Subscription = this.allCorrectAnswersFoundSnackBar.afterOpened().subscribe(() => {
          sub.unsubscribe();
          this.allCorrectAnswersFoundSnackBar = null;
        });
      }
    } else {
      style = this.STYLE_CLASS_ANSWER_WRONG;
    }
    button.classList.add(style);
    this.activatedAnswers.push(answer);
    this.game.activateAnswer(answer);
  }

  ngOnChanges(changes: SimpleChanges): void {
    this.reset();
  }

}
