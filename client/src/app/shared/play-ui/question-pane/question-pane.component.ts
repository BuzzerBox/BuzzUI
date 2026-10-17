import {Component, HostBinding, Input, OnChanges, OnDestroy, OnInit, SimpleChanges} from '@angular/core';
import {GameService} from '../../../services/game.service';
import {
  EAnswerStates,
  EGradeResults,
  EMediaStates,
  EQuestionAnswerStates,
  FileExtensionsService,
  GameStateHelper,
  MediaHelper,
  IAnswer,
  IAnswerSetStatePacket,
  IGradeAnswerPacket,
  IMarkTeamPacket,
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
import {SubscriptionsHelper} from '../../../helper/subscriptions.helper';
import {MatSnackBar, MatSnackBarRef, TextOnlySnackBar} from '@angular/material/snack-bar';
import {MatDialog, MatDialogRef} from '@angular/material/dialog';
import {TeamColorHelper} from '../../../helper/team-color.helper';
import {ScreenThemeHelper} from '../../../themes/screen-theme.helper';
import {
  DialogGradeAnswerComponent,
  IDialogGradeAnswerData,
  IDialogGradeAnswerOption,
  RELEASE_WITHOUT_GRADE,
  TGradeDialogResult
} from '../dialogs/dialog-grade-answer/dialog-grade-answer.component';

@Component({
    selector: 'app-question-pane',
    templateUrl: './question-pane.component.html',
    styleUrls: ['./question-pane.component.css'],
    standalone: false
})
export class QuestionPaneComponent implements OnInit, OnChanges, OnDestroy {
  private static readonly FLASH_WRONG_DURATION_IN_MS = 1000;
  @Input() isMaster = false;
  @Input() question: IQuestion;

  @HostBinding('class.screen') get isScreen(): boolean {
    return !this.isMaster;
  }

  private loggedInAnswers: IAnswer[];
  private activatedAnswers: IAnswer[];
  private correctAnswersThatAreLeft: number;
  private allCorrectAnswersFoundSnackBar: MatSnackBarRef<TextOnlySnackBar>;
  private answerSetStatePacketSubscription: Subscription;
  private mediaUpdateSubscription: Subscription;
  private markTeamSubscription: Subscription;
  private gradeAnswerSubscription: Subscription;
  private gradingRequestSubscription: Subscription;
  // only on the master: grading the answer of the team that buzzed
  private gradeDialogRef: MatDialogRef<DialogGradeAnswerComponent, TGradeDialogResult>;
  private gradeDialogTeamId: string;
  // set for a moment after a wrong answer, which lets the answers flash red
  public flashWrong = false;
  private flashWrongTimeout: ReturnType<typeof setTimeout>;
  // whether the question and the answers are visible on the screens; the master always sees both
  public showAnswers = true;
  public showQuestion = true;
  // the states these were derived from, to tell the master why something is hidden
  private questionState: EQuestionAnswerStates;
  private answerState: EQuestionAnswerStates;
  // whether the screens show the question's media, see isMediaShown()
  private mediaState: EMediaStates;

  constructor(private game: GameService, private bottomSheets: MatBottomSheet, private snackBar: MatSnackBar, private dialog: MatDialog) { }

  ngOnInit(): void {
    // Not needed here since ngOnChange is fired even upon the first instantiation
    // the master gets these too, when grading reveals the correct answers
    this.answerSetStatePacketSubscription = this.game.observeAnswerSetStatePacket().subscribe(this.handleAnswerSetStatePacket.bind(this));
    this.gradeAnswerSubscription = this.game.observeGradeAnswerPackets().subscribe(this.handleGradeAnswerPacket.bind(this));
    if (this.isMaster) {
      this.markTeamSubscription = this.game.observeMarkTeamPackets().subscribe(this.handleMarkTeamPacket.bind(this));
      // "Bewerten" next to the buzzer button, after the dialog was closed without grading
      this.gradingRequestSubscription = this.game.observeGradingRequests().subscribe(() => this.reopenGradeDialog());
      // after a reload or rejoining, a team may have buzzed already
      const gameState = this.game.getGameStateData();
      if (gameState?.setBuzzerLock && gameState.markedTeamIds?.length === 1) {
        this.openGradeDialog(gameState.markedTeamIds[0]);
      }
    }
    if (this.question.initialConfig) {
      this.showAnswers = (this.question.initialConfig.answerState === EQuestionAnswerStates.SHOWN && this.question.show as boolean) || !this.question.mediaDetails.fileSrc;
      this.showQuestion = this.question.initialConfig.questionState === EQuestionAnswerStates.SHOWN;
      this.questionState = this.question.initialConfig.questionState;
      this.mediaState = this.question.initialConfig.mediaState;
      this.answerState = this.question.initialConfig.answerState;
    }
    this.mediaUpdateSubscription = this.game.observeMediaStateUpdates().subscribe(
      (packet) => {
        this.showQuestion = packet.mediaQuestionState.questionState === EQuestionAnswerStates.SHOWN;
        this.questionState = packet.mediaQuestionState.questionState;
        this.mediaState = packet.mediaQuestionState.mediaState;
        this.answerState = packet.mediaQuestionState.answerState;
        switch (packet.mediaQuestionState.answerState) {
          case EQuestionAnswerStates.SHOWN:
            // questions without answer options (unchecked in setup) never show their answers
            this.showAnswers = !!this.question?.show;
            break;
          default:
            this.showAnswers = !this.question?.mediaDetails && this.question?.show as boolean;
        }
      }
    );
    this.restoreQuestionProgress();
  }

  /**
   * After a reload or a master rejoining, show the answers that were already logged in or revealed for this question
   */
  private restoreQuestionProgress(): void {
    const gameState = this.game.getGameStateData();
    if (this.question == null || this.question !== this.game.getCurrentQuestion()) {
      return;
    }
    for (const loggedAnswer of gameState?.loggedAnswers ?? []) {
      const answer = this.findAnswer(loggedAnswer);
      if (answer != null && !this.loggedInAnswers.includes(answer)) {
        this.loggedInAnswers.push(answer);
      }
    }
    for (const activatedAnswer of gameState?.activatedAnswers ?? []) {
      const answer = this.findAnswer(activatedAnswer);
      if (answer != null && !this.activatedAnswers.includes(answer)) {
        this.activatedAnswers.push(answer);
        if (answer.isCorrect) {
          this.correctAnswersThatAreLeft--;
        }
      }
    }
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

  /**
   * What the question is worth, e.g. "3 Punkte"; only shown if some question in the game is not worth the default 1
   */
  public getPointsLabel(): string | null {
    if (!this.game.hasCustomQuestionPoints()) {
      return null;
    }
    const points = GameService.getQuestionPoints(this.question);
    return points === 1 ? '1 Punkt' : `${points} Punkte`;
  }

  public getQuestionText(): string {
    return this.question?.text;
  }

  // The master shows and hides the question and the answers on the screens with their status labels. Like the
  // media, these states only exist for media questions, and answers turned off in setup can't be shown.
  public canToggleQuestion(): boolean {
    return this.isMaster && !!this.question?.mediaDetails;
  }

  public canToggleAnswers(): boolean {
    return this.canToggleQuestion() && !!this.question?.show;
  }

  public toggleQuestionVisibility(): void {
    if (!this.canToggleQuestion()) {
      return;
    }
    this.game.changeMediaState({questionState: this.showQuestion ? EQuestionAnswerStates.HIDDEN : EQuestionAnswerStates.SHOWN});
  }

  public toggleAnswersVisibility(): void {
    if (!this.canToggleAnswers()) {
      return;
    }
    this.game.changeMediaState({answerState: this.showAnswers ? EQuestionAnswerStates.HIDDEN : EQuestionAnswerStates.SHOWN});
  }

  public getQuestionVisibilityLabel(): string {
    return this.getVisibilityLabel(this.showQuestion, this.questionState);
  }

  public getAnswersVisibilityLabel(): string {
    return this.getVisibilityLabel(this.showAnswers, this.answerState);
  }

  private getVisibilityLabel(visible: boolean, state: EQuestionAnswerStates): string {
    if (visible) {
      return 'Auf der Anzeige sichtbar';
    }
    const media = this.question?.mediaDetails;
    if (state === EQuestionAnswerStates.WAIT_FOR_MEDIA && MediaHelper.hasEnd(media)) {
      if (MediaHelper.isSlideshow(media)) {
        return 'Auf der Anzeige verborgen – erscheint nach der Bildserie';
      }
      return 'Auf der Anzeige verborgen – erscheint nach dem ' + (FileExtensionsService.isAudio(media.fileSrc) ? 'Audio' : 'Video');
    }
    return 'Auf der Anzeige verborgen';
  }

  /**
   * Whether the screens show the media, as decided in MediaQuestionComponent: while it plays, and a slideshow also
   * once it is complete. A video keeps showing its picture once it was started, also paused and finished. The screens
   * then show the answers below the media.
   */
  public isMediaShown(): boolean {
    const media = this.question?.mediaDetails;
    if (!media) {
      return false;
    }
    switch (this.mediaState) {
      case EMediaStates.PLAYING:
      case EMediaStates.RESET:
        return true;
      case EMediaStates.PAUSED:
        return MediaHelper.isVideo(media);
      case EMediaStates.FINISHED:
        return MediaHelper.isSlideshow(media) || MediaHelper.isVideo(media);
      default:
        return false;
    }
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

  /**
   * The game is played in a quiz-show theme (see screen-themes.ts); the master then shows the answers' letters too
   */
  public isShowTheme(): boolean {
    return ScreenThemeHelper.isShowStyle(this.game.getGameStateData()?.themeId);
  }

  @HostBinding('class.show') get isShowStyle(): boolean {
    return this.isScreen && this.isShowTheme();
  }

  /**
   * A, B, C, … as on a quiz show, so players can call out their answer
   */
  public getAnswerLetter(index: number): string {
    return String.fromCharCode('A'.charCodeAt(0) + index);
  }

  /**
   * Logged-in answers take the color of the team that buzzed; without one, the brand's
   */
  public getLoggedInColor(): string {
    const marked = this.game.getGameStateData()?.markedTeamIds ?? [];
    const team = marked.length === 1 ? this.game.findTeam(marked[0]) : null;
    return team ? TeamColorHelper.getColor(team, this.game.getTeams() ?? []) : 'var(--bb-brand-light)';
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
      } else if (this.isMaster && setInService) {
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
    const answer = this.findAnswer(packet.answer);
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

  private findAnswer(answer: IAnswer): IAnswer | undefined {
    return this.question?.answers.find(a => GameStateHelper.isSameAnswer(a, answer));
  }

  /**
   * A team buzzed: the master grades its answer. The dialog goes away once the team is no longer marked, e.g. when the
   * buzzers were released or the question changed.
   */
  private handleMarkTeamPacket(packet: IMarkTeamPacket): void {
    if (packet.unmarkAll || (!packet.mark && packet.teamId === this.gradeDialogTeamId)) {
      this.closeGradeDialog();
    } else if (packet.mark) {
      this.openGradeDialog(packet.teamId);
    }
  }

  private openGradeDialog(teamId: string): void {
    const team = this.game.findTeam(teamId);
    if (team == null) {
      return;
    }
    this.closeGradeDialog();
    this.gradeDialogTeamId = teamId;
    const dialogRef = this.dialog.open<DialogGradeAnswerComponent, IDialogGradeAnswerData, TGradeDialogResult>(DialogGradeAnswerComponent, {
      data: {
        teamName: team.name,
        points: GameService.getQuestionPoints(this.question),
        answers: this.getGradeAnswerOptions(),
        answersHiddenOnScreens: !this.showAnswers
      }
    });
    this.gradeDialogRef = dialogRef;
    dialogRef.afterClosed().subscribe(result => {
      if (this.gradeDialogRef === dialogRef) {
        this.gradeDialogRef = null;
        this.gradeDialogTeamId = null;
      }
      // closing it without a grade (or because the team is no longer marked) leaves everything as it is
      if (result === RELEASE_WITHOUT_GRADE) {
        this.game.releaseBuzzerLock();
      } else if (result != null) {
        // a correct answer lights up where the answer options are shown
        this.game.gradeAnswer(teamId, result.result, this.areAnswersShownOnScreens(), result.answer);
      }
    });
  }

  private reopenGradeDialog(): void {
    const gameState = this.game.getGameStateData();
    if (this.gradeDialogRef == null && gameState?.setBuzzerLock && gameState.markedTeamIds?.length === 1) {
      this.openGradeDialog(gameState.markedTeamIds[0]);
    }
  }

  private areAnswersShownOnScreens(): boolean {
    return this.showAnswers && !!this.question?.show;
  }

  /**
   * The answers the master can pick as the one the team gave. Also while the screens hide them, e.g. until the media
   * ended: the picked one is revealed and lights up once they appear.
   */
  private getGradeAnswerOptions(): IDialogGradeAnswerOption[] {
    if (!this.question?.show) {
      return [];
    }
    return (this.question?.answers ?? []).map((answer, i) => ({
      answer,
      letter: this.getAnswerLetter(i),
      isRevealed: this.isActivated(answer)
    }));
  }

  private closeGradeDialog(): void {
    this.gradeDialogRef?.close();
  }

  private handleGradeAnswerPacket(packet: IGradeAnswerPacket): void {
    if (packet.result !== EGradeResults.WRONG) {
      return;
    }
    clearTimeout(this.flashWrongTimeout);
    this.flashWrong = true;
    this.flashWrongTimeout = setTimeout(() => this.flashWrong = false, QuestionPaneComponent.FLASH_WRONG_DURATION_IN_MS);
  }

  ngOnDestroy(): void {
    SubscriptionsHelper.cleanUpSubscriptions(this.answerSetStatePacketSubscription, this.mediaUpdateSubscription,
      this.markTeamSubscription, this.gradeAnswerSubscription, this.gradingRequestSubscription);
    clearTimeout(this.flashWrongTimeout);
    this.closeGradeDialog();
  }

  public isQuestionExisting(): boolean {
    return this.question != null;
  }

}
