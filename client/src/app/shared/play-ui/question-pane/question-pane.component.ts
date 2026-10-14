import {Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges} from '@angular/core';
import {GameService} from '../../../services/game.service';
import {
  EAnswerStates,
  EMediaStates,
  EQuestionAnswerStates,
  FileExtensionsService,
  IAnswer,
  IAnswerSetStatePacket,
  IQuestion
} from '../../../../../../shared/shared';
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
    styleUrls: ['./question-pane.component.css'],
    standalone: false
})
export class QuestionPaneComponent implements OnInit, OnChanges, OnDestroy {
  @Input() isMaster = false;
  @Input() question: IQuestion;

  private loggedInAnswers: IAnswer[];
  private activatedAnswers: IAnswer[];
  private correctAnswersThatAreLeft: number;
  private allCorrectAnswersFoundSnackBar: MatSnackBarRef<TextOnlySnackBar>;
  private answerSetStatePacketSubscription: Subscription;
  private mediaUpdateSubscription: Subscription;
  // whether the question and the answers are visible on the screens; the master always sees both
  public showAnswers = true;
  public showQuestion = true;
  // the states these were derived from, to tell the master why something is hidden
  private questionState: EQuestionAnswerStates;
  private answerState: EQuestionAnswerStates;

  constructor(private game: GameService, private bottomSheets: MatBottomSheet, private snackBar: MatSnackBar) { }

  ngOnInit(): void {
    // Not needed here since ngOnChange is fired even upon the first instantiation
    if (!this.isMaster) {
      this.answerSetStatePacketSubscription = this.game.observeAnswerSetStatePacket().subscribe(this.handleAnswerSetStatePacket.bind(this));
    }
    if (this.question.initialConfig) {
      this.showAnswers = (this.question.initialConfig.answerState === EQuestionAnswerStates.SHOWN && this.question.show as boolean) || !this.question.mediaDetails.fileSrc;
      this.showQuestion = this.question.initialConfig.questionState === EQuestionAnswerStates.SHOWN;
      this.questionState = this.question.initialConfig.questionState;
      this.answerState = this.question.initialConfig.answerState;
    }
    this.mediaUpdateSubscription = this.game.observeMediaStateUpdates().subscribe(
      (packet) => {
        this.showQuestion = packet.mediaQuestionState.questionState === EQuestionAnswerStates.SHOWN;
        this.questionState = packet.mediaQuestionState.questionState;
        this.answerState = packet.mediaQuestionState.answerState;
        switch (packet.mediaQuestionState.answerState) {
          case EQuestionAnswerStates.SHOWN:
            this.showAnswers = true;
            break;
          default:
            this.showAnswers = !this.question?.mediaDetails && this.question?.show as boolean;
        }
      }
    );
  }

  public reset(): void {
    this.loggedInAnswers = [];
    this.activatedAnswers = [];
    this.correctAnswersThatAreLeft = 0;
    if (this.question) {
      for (const answer of this.question.answers) {
        if (answer.isCorrect) {
          this.correctAnswersThatAreLeft++;
        }
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
    return this.question?.text;
  }

  public getQuestionVisibilityLabel(): string {
    return this.getVisibilityLabel(this.showQuestion, this.questionState);
  }

  public getAnswersVisibilityLabel(): string {
    if (!this.showAnswers && !this.question?.show) {
      return 'Auf der Anzeige verborgen – in der Einrichtung ausgeblendet';
    }
    return this.getVisibilityLabel(this.showAnswers, this.answerState);
  }

  private getVisibilityLabel(visible: boolean, state: EQuestionAnswerStates): string {
    if (visible) {
      return 'Auf der Anzeige sichtbar';
    }
    const mediaSrc = this.question?.mediaDetails?.fileSrc;
    if (state === EQuestionAnswerStates.WAIT_FOR_MEDIA && mediaSrc && FileExtensionsService.isVideo(mediaSrc)) {
      return 'Auf der Anzeige verborgen – erscheint nach dem Video';
    }
    return 'Auf der Anzeige verborgen';
  }

  public getAnswers(): IAnswer[] {
    return this.question?.answers;
  }

  public onClickAnswer(answer, button: HTMLButtonElement): void {
    // answers hidden on the screens can be seen but not used by the master
    if (!this.isMaster || !this.showAnswers || this.activatedAnswers.includes(answer) || this.correctAnswersThatAreLeft === 0) {
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
            this.activateAnswer(answer);
            break;
          case EDecisionBottomSheetAnswerOptions.LOG_IN:
            this.logInAnswer(answer);
            break;
          case EDecisionBottomSheetAnswerOptions.LOG_OUT:
            this.logOutAnswer(answer);
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

  public isLoggedIn(answer: IAnswer): boolean {
    return this.loggedInAnswers.includes(answer);
  }

  public isActivated(answer: IAnswer): boolean {
    return this.activatedAnswers.includes(answer);
  }

  public logInAnswer(answer: IAnswer, setInService: boolean = true): void {
    this.loggedInAnswers.push(answer);
    if (setInService) {
      this.game.logInAnswer(answer);
    }
  }

  public logOutAnswer(answer: IAnswer, setInService: boolean = true): void {
    ArraysHelper.remove<IAnswer>(this.loggedInAnswers, answer);
    if (setInService) {
      this.game.logOutAnswer(answer);
    }
  }

  public activateAnswer(answer: IAnswer, setInService: boolean = true): void {
    ArraysHelper.remove<IAnswer>(this.loggedInAnswers, answer);
    if (answer.isCorrect) {
      this.correctAnswersThatAreLeft--;
      if (this.correctAnswersThatAreLeft === 0 && this.isMaster) {
        this.allCorrectAnswersFoundSnackBar = this.snackBar.open('Alle richtigen Antworten wurden aufgedeckt.', 'Okay');
        const sub: Subscription = this.allCorrectAnswersFoundSnackBar.afterOpened().subscribe(() => {
          sub.unsubscribe();
          this.allCorrectAnswersFoundSnackBar = null;
        });
      } else if (this.isMaster) {
        // if there are correct answers left, manually release the buzzer lock
        this.game.sendUnmarkAllTeamsPacket();
        this.game.setBuzzerLock(false);
      }
    }
    this.activatedAnswers.push(answer);
    if (setInService) {
      this.game.activateAnswer(answer);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    this.reset();
  }

  private handleAnswerSetStatePacket(packet: IAnswerSetStatePacket): void {
    // use this question's own answer object, the button styles are looked up by reference
    const answer = this.question?.answers[this.getAnswerIndex(packet.answer)];
    if (answer == null) {
      return;
    }
    if (packet.state === EAnswerStates.LOG_IN) {
      this.logInAnswer(answer, false);
    } else if (packet.state === EAnswerStates.LOG_OUT) {
      this.logOutAnswer(answer, false);
    } else if (packet.state === EAnswerStates.ACTIVATE) {
      this.activateAnswer(answer, false);
    }
  }

  private getAnswerIndex(answer: IAnswer): number {
    for (let i = 0; i < this.question.answers.length; i++) {
      if (answer.isCorrect === this.question.answers[i].isCorrect && answer.text === this.question.answers[i].text) {
        return i;
      }
    }
  }

  ngOnDestroy(): void {
    if (this.answerSetStatePacketSubscription != null) {
      this.answerSetStatePacketSubscription.unsubscribe();
    }
    if (this.mediaUpdateSubscription != null) {
      this.mediaUpdateSubscription.unsubscribe();
    }
  }

  public isQuestionExisting(): boolean {
    return this.question != null;
  }

}
