import {Component, HostListener, Input, OnDestroy, OnInit} from '@angular/core';
import {GameService} from '../../services/game.service';
import {
  ITeam,
  IQuestion,
  IEndGamePacket,
  IMarkTeamPacket
} from '../../../../../shared/shared';
import {DialogConfirmEndingGameComponent} from './dialogs/dialog-confirm-ending-game/dialog-confirm-ending-game.component';
import {MatDialog} from '@angular/material/dialog';
import {Subscription} from 'rxjs';
import {SubscriptionsHelper} from '../../helper/subscriptions.helper';

@Component({
  selector: 'app-play-ui',
  templateUrl: './play-ui.component.html',
  styleUrls: ['./play-ui.component.css']
})
export class PlayUiComponent implements OnInit, OnDestroy {
  @Input() isMaster = false;

  public currentQuestion: IQuestion;
  public isGameOver = false;
  private setQuestionPacketSubscription: Subscription;

  constructor(private game: GameService, private dialog: MatDialog) { }

  ngOnInit(): void {
    this.currentQuestion = this.game.getCurrentQuestion();
    if (!this.isMaster) {
      this.game.setCallbackUpdateCurrentQuestion(this.callbackUpdateCurrentQuestion.bind(this));
      this.game.setCallbackEndGame(this.callbackEndGame.bind(this));
      // There is some angular directive to achieve the binding of a listener (@HostListener) but it is not possible to remove that binding
      // or have it react to some boolean state but we only need it if this component is used from a screen, thus I prefer the "old" JS-way
      // of adding an event listener
      document.addEventListener('keypress', this.handleKeyboardEvent.bind(this));
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
      document.removeEventListener('keypress', this.handleKeyboardEvent.bind(this));
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
