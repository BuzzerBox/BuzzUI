import {Component, Input, OnInit} from '@angular/core';
import {ITeam} from '../../../../../../shared/objects/shared';
import {GameService} from '../../../services/game.service';

@Component({
  selector: 'app-team-card',
  templateUrl: './team-card.component.html',
  styleUrls: ['./team-card.component.css']
})
export class TeamCardComponent implements OnInit {
  @Input() team: ITeam;
  @Input() isMaster = false;

  constructor(private game: GameService) { }

  ngOnInit(): void {
  }

  public addPoint(): void {
    this.game.addPoint(this.team);
  }

  public removePoint(): void {
    this.game.removePoint(this.team);
  }

  public getName(): string {
    return this.team.name;
  }

  public getPoints(): number {
    return this.team.points;
  }

}
