import {Component, Input, OnInit} from '@angular/core';
import {GameService, ITeamsScore} from '../../services/game.service';
import {
  ITeam,
  IQuestion
} from '../../../../../shared/objects/shared';
import {DialogConfirmEndingGameComponent} from './dialogs/dialog-confirm-ending-game/dialog-confirm-ending-game.component';
import {MatDialog} from '@angular/material/dialog';
import {Subscription} from 'rxjs';

@Component({
  selector: 'app-play-ui',
  templateUrl: './play-ui.component.html',
  styleUrls: ['./play-ui.component.css']
})
export class PlayUiComponent implements OnInit {
  @Input() isMaster = false;

  public currentQuestion: IQuestion;
  public isGameOver = false;

  constructor(private game: GameService, private dialog: MatDialog) { }

  ngOnInit(): void {
    this.currentQuestion = this.game.getCurrentQuestion();
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
    this.currentQuestion = this.game.getNextQuestion()
  }

  public hasPreviousQuestion(): boolean {
    return this.game.hasPreviousQuestion();
  }

  public hasNextQuestion(): boolean {
    return this.game.hasNextQuestion();
  }

  public endGameLocally(): void {
    let sub: Subscription = this.dialog.open(DialogConfirmEndingGameComponent).afterClosed().subscribe(result => {
      if (result) {
        this.isGameOver = true;
        this.game.endGame();
      }
      sub.unsubscribe();
      sub = null;
    });
  }

  public getTeamsOrderedByScore(): ITeam[] {
    return this.game.getTeamsOrderedByScore();
  }

  public endGameOnServerAndGoToStartScreen(): void {
    // TODO: send to gameserverice
  }

}
