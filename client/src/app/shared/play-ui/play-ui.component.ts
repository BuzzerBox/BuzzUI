import {Component, HostBinding, Input, OnDestroy, OnInit} from '@angular/core';
import {GameService} from '../../services/game.service';
import {
  ITeam,
  IQuestion,
  IEndGamePacket
} from '../../../../../shared/shared';
import {DialogConfirmEndingGameComponent} from './dialogs/dialog-confirm-ending-game/dialog-confirm-ending-game.component';
import {MatDialog} from '@angular/material/dialog';
import {Subscription} from 'rxjs';
import {SubscriptionsHelper} from '../../helper/subscriptions.helper';
import {ConfigService} from '../../services/config.service';

@Component({
    selector: 'app-play-ui',
    templateUrl: './play-ui.component.html',
    styleUrls: ['./play-ui.component.css'],
    standalone: false
})
export class PlayUiComponent implements OnInit, OnDestroy {
  @Input() isMaster = false;

  // the screens scale everything with their size, see the stylesheet
  @HostBinding('class.screen') get isScreen(): boolean {
    return !this.isMaster;
  }

  /**
   * Rows of team cards on each side of the screens; at least 4, so a few teams don't get huge cards
   */
  @HostBinding('style.--team-rows') get teamRows(): number {
    return Math.max(4, Math.ceil((this.getTeams()?.length ?? 0) / 2));
  }

  public currentQuestion: IQuestion;
  public isGameOver = false;
  private setQuestionPacketSubscription: Subscription;
  // kept to remove the very same listener again
  private readonly keydownListener = (event: KeyboardEvent) => this.handleKeyboardEvent(event);

  constructor(private game: GameService, private dialog: MatDialog) { }

  ngOnInit(): void {
    this.currentQuestion = this.game.getCurrentQuestion();
    if (!this.isMaster) {
      this.game.setCallbackUpdateCurrentQuestion(this.callbackUpdateCurrentQuestion.bind(this));
      this.game.setCallbackEndGame(this.callbackEndGame.bind(this));
      // There is some angular directive to achieve the binding of a listener (@HostListener) but it is not possible to remove that binding
      // or have it react to some boolean state but we only need it if this component is used from a screen, thus I prefer the "old" JS-way
      // of adding an event listener
      // keys only work as buzzers where the config allows it, see enableBrowserKeypressEvents
      if (ConfigService.get().enableBrowserKeypressEvents) {
        document.addEventListener('keydown', this.keydownListener);
      }
    }
  }

  public getTeams(): ITeam[] {
    return this.game.getTeams();
  }

  public getQuestions(): IQuestion[] {
    return this.game.getQuestions();
  }

  public getCurrentQuestion(): IQuestion {
    return this.game.getCurrentQuestion();
  }

  public getPreviousQuestion(): void {
    this.currentQuestion = this.game.getPreviousQuestion();
  }

  public getNextQuestion(): void {
    this.currentQuestion = this.game.getNextQuestion();
  }

  public hasPreviousQuestion(): boolean {
    return this.game.hasPreviousQuestion();
  }

  public hasNextQuestion(): boolean {
    return this.game.hasNextQuestion();
  }

  public endGame(): void {
    let sub: Subscription = this.dialog.open(DialogConfirmEndingGameComponent).afterClosed().subscribe(result => {
      if (result) {
        this.isGameOver = true;
        this.game.endGame();
      }
      sub.unsubscribe();
      sub = null;
    });
  }

  // TODO implement this as observable instead of this callback fizzle
  private callbackUpdateCurrentQuestion(): void {
    this.currentQuestion = this.game.getCurrentQuestion();
  }

  ngOnDestroy(): void {
    SubscriptionsHelper.cleanUpSubscriptions(this.setQuestionPacketSubscription);
    if (!this.isMaster) {
      document.removeEventListener('keydown', this.keydownListener);
    }
  }

  private callbackEndGame(packet: IEndGamePacket): void {
    this.isGameOver = true;
  }

  handleKeyboardEvent(event: KeyboardEvent): void {
    console.log(event.code);
    this.game.sendKeypress(event.code);
  }





}
