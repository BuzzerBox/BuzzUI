import {Component, Input, OnInit} from '@angular/core';
import {ClientGameMasterAndScreenService} from '../../../services/game-client/client-game-master-and-screen.service';
import {ITeam} from '../../../../../../shared/shared';

@Component({
  selector: 'app-score-board',
  templateUrl: './score-board.component.html',
  styleUrls: ['./score-board.component.css']
})
export class ScoreBoardComponent implements OnInit {
  @Input() isMaster = false;

  constructor(private game: ClientGameMasterAndScreenService) { }

  ngOnInit(): void {
  }

  public getTeamsOrderedByScore(): ITeam[] {
    return this.game.getTeamsOrderedByScore();
  }

  public resetServer(): void {
    this.game.resetServer();
  }

}
