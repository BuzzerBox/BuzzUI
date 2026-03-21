import {Component, Input, OnInit} from '@angular/core';
import {GameService} from '../../../services/game.service';
import {ITeam} from '../../../../../../shared/shared';

@Component({
    selector: 'app-score-board',
    templateUrl: './score-board.component.html',
    styleUrls: ['./score-board.component.css'],
    standalone: false
})
export class ScoreBoardComponent implements OnInit {
  @Input() isMaster = false;
  public sortedTeams: ITeam[] = [];

  constructor(private game: GameService) { }

  ngOnInit(): void {
    this.sortedTeams = this.game.getTeamsOrderedByScore();
  }

  public resetServer(): void {
    this.game.resetServer();
  }

}
