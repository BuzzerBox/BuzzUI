import {Component, Input, OnDestroy, OnInit} from '@angular/core';
import {ITeam, IMarkTeamPacket} from '../../../../../../shared/shared';
import {GameService} from '../../../services/game.service';
import {SubscriptionsHelper} from '../../../helper/subscriptions.helper';
import {Subscription} from 'rxjs';

@Component({
    selector: 'app-team-card',
    templateUrl: './team-card.component.html',
    styleUrls: ['./team-card.component.css'],
    standalone: false
})
export class TeamCardComponent implements OnInit, OnDestroy {
  @Input() team: ITeam;
  @Input() isMaster = false;

  private markTeamPacketsSubscription: Subscription;
  public isMarked = false;

  constructor(private game: GameService) { }

  ngOnInit(): void {
    this.markTeamPacketsSubscription = this.game.observeMarkTeamPackets().subscribe(this.onMarkTeamPacket.bind(this));
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

  private onMarkTeamPacket(packet: IMarkTeamPacket): void {
    if (packet.unmarkAll) {
      this.isMarked = false;
    } else if (this.team.teamId === packet.teamId) {
      this.isMarked = packet.mark;
    }
  }

  ngOnDestroy(): void {
    SubscriptionsHelper.cleanUpSubscriptions(this.markTeamPacketsSubscription);
  }

  private markTeamInvert(): void {
    this.isMarked = !this.isMarked;
    this.game.setMarkTeam(this.team.teamId, this.isMarked);
  }

}
