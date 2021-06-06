import {Component, Input, OnDestroy, OnInit} from '@angular/core';
import {GameService, ITeamsScore} from '../../services/game.service';
import {
  ITeam,
  IQuestion,
  IEndGamePacket
} from '../../../../../shared/objects/shared';
import {DialogConfirmEndingGameComponent} from './dialogs/dialog-confirm-ending-game/dialog-confirm-ending-game.component';
import {MatDialog} from '@angular/material/dialog';
import {Observable, Subscription} from 'rxjs';

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

  // TODO implement this as observalbe instead of this callback fizzle
  private callbackUpdateCurrentQuestion(): void {
    this.currentQuestion = this.game.getCurrentQuestion();
  }

  ngOnDestroy(): void {
    if (this.setQuestionPacketSubscription != null) {
      this.setQuestionPacketSubscription.unsubscribe();
    }
  }

  private callbackEndGame(packet: IEndGamePacket): void {
    this.isGameOver = true;
  }

}
