import {Component, HostBinding, Input, OnChanges, OnDestroy, OnInit, SimpleChanges} from '@angular/core';
import {GameService} from '../../../services/game.service';
import {
  EAnswerStates,
  EGradeResults,
  EMediaStates,
  EQuestionAnswerStates,
  GameStateHelper,
  MediaHelper,
  IAnswer,
  IAnswerSetStatePacket,
  IGradeAnswerPacket,
  IMarkTeamPacket,
  IMediaDetails,
  IMediaQuestionState,
  IQuestion,
  PacketHelper
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
import {ScreenThemeHelper} from '../../../themes/screen-theme.helper';
import {
  DialogGradeAnswerComponent,
  IDialogGradeAnswerData,
  IDialogGradeAnswerOption,
  RELEASE_WITHOUT_GRADE,
  TGradeDialogResult
} from '../dialogs/dialog-grade-answer/dialog-grade-answer.component';
import {MediaKindHelper} from '../../../helper/media-kind.helper';
import {openRevealConfirmation} from '../dialogs/reveal-confirmation';

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
  // before the first question of a new game, see IGameState.welcome
  @Input() welcome = false;

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
  // the question whether to reveal the question or the answers, while it is open
  private revealConfirmationRef: MatDialogRef<unknown, boolean> | null = null;
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
    this.mediaUpdateSubscription = this.game.observeMediaStateUpdates().subscribe(
      (packet) => this.applyMediaQuestionState(packet.mediaQuestionState)
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
    this.dismissAllCorrectAnswersFoundSnackBar();
  }

  /**
   * It belongs to the question, so it goes away when the question changes or the game is left
   */
  private dismissAllCorrectAnswersFoundSnackBar(): void {
    this.allCorrectAnswersFoundSnackBar?.dismiss();
    this.allCorrectAnswersFoundSnackBar = null;
  }

  public getCurrentQuestionNumber(): number {
    return this.game.getCurrentQuestionNumber() + 1;
  }

  /**
   * For the welcome screen; games set up without being stored have none
   */
  public getGameName(): string | undefined {
    return this.game.getGameStateData()?.gameName;
  }

  public getTotalQuestionNumber(): number {
    return this.game.getQuestions().length;
  }

  /**
   * What the question is worth, e.g. "3 Punkte"; only shown if some question in the game is not worth the default 1
   */
  public getPointsLabel(): string | null {
    return this.game.getQuestionPointsLabel(this.question);
  }

  public getQuestionText(): string {
    return this.question?.text;
  }

  // The master shows and hides the question, the answers and the media on the screens in one pane, with their status
  // labels. Like the media, the states of question and answers only exist for media questions, and answers turned off
  // in setup can't be shown.
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

  /**
   * The master taps the question or the answers where they are shown hidden: once confirmed, they appear on the screens
   */
  public askToRevealQuestion(): void {
    if (this.showQuestion || !this.canToggleQuestion()) {
      return;
    }
    this.askToReveal('question', this.questionState, () => this.toggleQuestionVisibility());
  }

  public canRevealAnswers(): boolean {
    return !this.showAnswers && this.canToggleAnswers();
  }

  public askToRevealAnswers(): void {
    if (!this.canRevealAnswers()) {
      return;
    }
    this.askToReveal('answers', this.answerState, () => this.toggleAnswersVisibility());
  }

  private askToReveal(part: 'question' | 'answers', state: EQuestionAnswerStates, reveal: () => void): void {
    // one question at a time, e.g. after a double tap
    if (this.revealConfirmationRef != null) {
      return;
    }
    const media = this.question?.mediaDetails;
    let waitingNote: string | null = null;
    if (QuestionPaneComponent.isWaitingForMedia(false, state, media)) {
      const article = MediaHelper.isSlideshow(media) ? 'der' : 'dem';
      waitingNote = `Sonst ${part === 'question' ? 'erscheint sie' : 'erscheinen sie'} nach ${article} ${MediaKindHelper.getName(media)}.`;
    }
    const question = this.question;
    this.revealConfirmationRef = openRevealConfirmation(this.dialog, part, waitingNote);
    this.revealConfirmationRef.afterClosed().subscribe(confirmed => {
      this.revealConfirmationRef = null;
      // not if the question changed meanwhile, or the part appeared by itself
      if (confirmed && this.question === question) {
        if (part === 'question' ? !this.showQuestion : !this.showAnswers) {
          reveal();
        }
      }
    });
  }

  public getQuestionVisibilityNote(): string {
    return QuestionPaneComponent.getVisibilityNote(this.showQuestion, this.questionState, this.question?.mediaDetails, this.canToggleQuestion());
  }

  public getAnswersVisibilityNote(): string {
    return QuestionPaneComponent.getVisibilityNote(this.showAnswers, this.answerState, this.question?.mediaDetails, this.canToggleAnswers());
  }

  public getQuestionVisibilityTitle(): string {
    return QuestionPaneComponent.getVisibilityTitle('Frage', this.showQuestion, this.questionState, this.question?.mediaDetails);
  }

  public getAnswersVisibilityTitle(): string {
    return QuestionPaneComponent.getVisibilityTitle('Antworten', this.showAnswers, this.answerState, this.question?.mediaDetails);
  }

  /**
   * What a visibility button says after the part's name, kept short so the buttons fit in one row on small displays.
   * The icon, its color and the action ("Zeigen"/"Verbergen") already tell whether the part is on the screens, so a
   * button that toggles only adds when a hidden part appears by itself, e.g. " · nach Video". One that can't toggle
   * (questions without media) has no action, so it says its state. The pane's title says that it is about the screens.
   */
  public static getVisibilityNote(visible: boolean, state: EQuestionAnswerStates, media: IMediaDetails | undefined,
                                  canToggle: boolean): string {
    if (!canToggle) {
      return visible ? ': sichtbar' : ': verborgen';
    }
    if (QuestionPaneComponent.isWaitingForMedia(visible, state, media)) {
      return ' · nach ' + MediaKindHelper.getName(media);
    }
    return '';
  }

  /**
   * The button's tooltip, with the full sentence that the label leaves out
   */
  public static getVisibilityTitle(part: string, visible: boolean, state: EQuestionAnswerStates,
                                   media: IMediaDetails | undefined): string {
    const action = `${part} auf der Anzeige ${visible ? 'verbergen' : 'zeigen'}`;
    if (QuestionPaneComponent.isWaitingForMedia(visible, state, media)) {
      const article = MediaHelper.isSlideshow(media) ? 'der' : 'dem';
      const appears = part === 'Antworten' ? 'erscheinen sie' : 'erscheint sie';
      return `${action}; sonst ${appears} nach ${article} ${MediaKindHelper.getName(media)}`;
    }
    return action;
  }

  private static isWaitingForMedia(visible: boolean, state: EQuestionAnswerStates, media: IMediaDetails | undefined): boolean {
    return !visible && state === EQuestionAnswerStates.WAIT_FOR_MEDIA && MediaHelper.hasEnd(media);
  }

  /**
   * Of the media that have a visibility toggle
   */
  public getMediaName(): string {
    return MediaKindHelper.getName(this.question?.mediaDetails);
  }

  public getMediaIcon(): string {
    return MediaKindHelper.getIcon(this.question?.mediaDetails);
  }

  /**
   * Audio has nothing to hide, its note is always shown (see MediaQuestionComponent); video and audio are played in the
   * media controls
   */
  public hasMediaVisibility(): boolean {
    return !!this.question?.mediaDetails && !MediaKindHelper.isAudio(this.question.mediaDetails);
  }

  public getMediaToggleAction(): string {
    return this.isMediaShown() ? 'Verbergen' : 'Zeigen';
  }

  public getMediaToggleTitle(): string {
    return `${this.getMediaName()} auf der Anzeige ${this.getMediaToggleAction().toLowerCase()}`;
  }

  /**
   * Shows or hides the media; the media controls below have the rest. A video is shown without playing it, e.g. its
   * first frame before it starts, and hiding it also stops it. Playing it shows it, see MediaRemoteComponent.
   */
  public toggleMedia(): void {
    const isVideo = MediaHelper.isVideo(this.question?.mediaDetails);
    if (this.isMediaShown()) {
      this.game.changeMediaState({mediaState: isVideo ? EMediaStates.HIDDEN : EMediaStates.PAUSED});
    } else {
      this.game.changeMediaState({mediaState: isVideo ? EMediaStates.PAUSED : EMediaStates.PLAYING});
    }
  }

  /**
   * Whether the screens show the media, as decided in MediaQuestionComponent: while it plays, and a slideshow also
   * once it is complete. A video shows its picture unless it is hidden, also paused (e.g. its first frame) and
   * finished.
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
    // answers hidden on the screens can be seen but not used by the master (a tap on their outline asks to reveal them)
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
        const snackBarRef = this.snackBar.open('Alle richtigen Antworten wurden aufgedeckt.', 'Okay');
        this.allCorrectAnswersFoundSnackBar = snackBarRef;
        // closed with "Okay", or replaced by another snack bar
        snackBarRef.afterDismissed().subscribe(() => {
          if (this.allCorrectAnswersFoundSnackBar === snackBarRef) {
            this.allCorrectAnswersFoundSnackBar = null;
          }
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
    if (changes['question']) {
      // The pane stays when the question changes. Until the server's media state for the new question arrives, the
      // previous question's visibility would otherwise apply, so start with the state the server will send.
      this.applyMediaQuestionState(this.question?.initialConfig ?? PacketHelper.getDefaultMediaState());
    }
  }

  private applyMediaQuestionState(state: IMediaQuestionState): void {
    this.showQuestion = state.questionState === EQuestionAnswerStates.SHOWN;
    this.questionState = state.questionState;
    this.mediaState = state.mediaState;
    this.answerState = state.answerState;
    if (state.answerState === EQuestionAnswerStates.SHOWN) {
      // questions without answer options (unchecked in setup) never show their answers
      this.showAnswers = !!this.question?.show;
    } else {
      this.showAnswers = !this.question?.mediaDetails && !!this.question?.show;
    }
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
      // a tap next to it mustn't put the grade off by accident; the X and "Später bewerten" close it
      disableClose: true,
      data: {
        teamName: team.name,
        questionText: this.getQuestionText(),
        points: GameService.getQuestionPoints(this.question),
        answers: this.getGradeAnswerOptions(),
        answersHiddenOnScreens: !this.showAnswers,
        scoring: this.game.getScoring()
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
    this.revealConfirmationRef?.close(false);
    this.dismissAllCorrectAnswersFoundSnackBar();
  }

  public isQuestionExisting(): boolean {
    return this.question != null;
  }

}
