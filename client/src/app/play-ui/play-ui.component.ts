import {Component, Input, OnInit} from '@angular/core';
import {GameService} from '../services/game.service';
import {
  ITeam,
  IQuestion
} from '../../../../shared/objects/shared';

@Component({
  selector: 'app-play-ui',
  templateUrl: './play-ui.component.html',
  styleUrls: ['./play-ui.component.css']
})
export class PlayUiComponent implements OnInit {
  @Input() isMaster = false;

  // public teams: ITeam[];
  // public questions: IQuestion[];

  constructor(private game: GameService) { }

  ngOnInit(): void {
  }

  public getTeams(): ITeam[] {
    return this.game.getTeams();
  }

  public getQuestion(): IQuestion[] {
    return this.game.getQuestions();
  }

  public getCurrentQuestion(): IQuestion {
    return this.game.getCurrentQuestion();
  }

}
