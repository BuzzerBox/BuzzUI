import {Component, EventEmitter, HostBinding, Input, Output} from '@angular/core';
import {GameService} from '../../../services/game.service';
import {IQuestion, ITeam} from '../../../../../../shared/shared';
import {TeamColorHelper} from '../../../helper/team-color.helper';
import {ScreenThemeHelper} from '../../../themes/screen-theme.helper';

/**
 * While teams wager: on a Daily Double the team that picked it, in the final every team. The master enters the wagers
 * (and shows the final's question once all are in); the screens show the Daily Double or the category of the final,
 * and who wagered already, but not how much.
 */
@Component({
    selector: 'app-wager-panel',
    templateUrl: './wager-panel.component.html',
    styleUrls: ['./wager-panel.component.css'],
    standalone: false
})
export class WagerPanelComponent {
  @Input() isMaster = false;
  @Output() questionShown = new EventEmitter<IQuestion>();

  @HostBinding('class.screen') get isScreen(): boolean {
    return !this.isMaster;
  }

  // the quiz-show themes, see screen-themes.ts
  @HostBinding('class.show') get isShowStyle(): boolean {
    return this.isScreen && ScreenThemeHelper.isShowStyle(this.game.getGameStateData()?.themeId);
  }

  constructor(private game: GameService) { }

  public isFinal(): boolean {
    return this.game.getCurrentFinalRound() != null;
  }

  public getCategory(): string {
    return this.game.getCurrentFinalRound()?.category ?? this.game.getOpenTile()?.category.name ?? '';
  }

  public getTileValue(): number | undefined {
    return this.game.getOpenTile()?.value;
  }

  public getTeams(): ITeam[] {
    return this.game.getWageringTeams();
  }

  /**
   * Before the master said which team picked the Daily Double, it is chosen here
   */
  public getAllTeams(): ITeam[] {
    return this.game.getTeams() ?? [];
  }

  public getPickingTeam(): ITeam | undefined {
    return this.game.getPickingTeam();
  }

  public choosePickingTeam(team: ITeam): void {
    this.game.setPickingTeam(team.teamId);
  }

  public getWager(team: ITeam): number | undefined {
    return this.game.getWager(team.teamId);
  }

  public hasWagered(team: ITeam): boolean {
    return this.getWager(team) !== undefined;
  }

  public getMaxWager(team: ITeam): number {
    return this.game.getMaxWager(team);
  }

  public setWager(team: ITeam, value: string): void {
    if (value.trim() !== '') {
      this.game.setWager(team.teamId, Number(value));
    }
  }

  public haveAllWagered(): boolean {
    return this.game.haveAllTeamsWagered();
  }

  public showQuestion(): void {
    this.questionShown.emit(this.game.showFinalQuestion());
  }

  public getTeamColor(team: ITeam): string {
    return TeamColorHelper.getColor(team, this.getAllTeams());
  }

  public formatPoints(points: number): string {
    return Math.abs(points) === 1 ? `${points} Punkt` : `${points} Punkte`;
  }
}
