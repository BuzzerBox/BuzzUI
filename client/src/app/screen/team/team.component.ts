import {Component, DoCheck, OnInit} from '@angular/core';
import {ITeam} from '../../../../../shared/shared';
import {GameService} from '../../services/game.service';
import {TeamColorHelper} from '../../helper/team-color.helper';
import {ScreenThemeHelper} from '../../themes/screen-theme.helper';

/**
 * A screen in front of one team, for bigger quiz shows: only the team's name and points, as its card on the screens of
 * the game shows them (lit up while the team holds the buzzer lock), on the whole screen. Until a team is chosen, it
 * shows the choice of one. The team is kept for the window, so the screen finds it again when it loads again.
 */
@Component({
    selector: 'app-team',
    templateUrl: './team.component.html',
    styleUrls: ['./team.component.css'],
    standalone: false
})
export class TeamComponent implements OnInit, DoCheck {
  // the team shown, null while there is none to show
  public team: ITeam | null = null;
  // the chosen team, if it isn't in the game anymore
  public missingTeamName: string | null = null;

  constructor(private game: GameService) { }

  public get isShowStyle(): boolean {
    return ScreenThemeHelper.isShowStyle(this.game.getGameStateData()?.themeId);
  }

  ngOnInit(): void {
    // the theme of this game, for the whole page and the waiting screen after it
    ScreenThemeHelper.apply(this.game.getGameStateData()?.themeId);
    this.findTeam();
  }

  /**
   * The master can rename and remove teams during the game, see IUpdateTeamsPacket
   */
  ngDoCheck(): void {
    this.findTeam();
  }

  /**
   * The chosen team, by its ID or, after a restart of the server (which gives the buzzers new IDs), by its name
   */
  private findTeam(): void {
    const chosen = this.game.getScreenTeam();
    const teams = this.getTeams();
    const team = chosen == null ? null
      : teams.find(t => t.teamId === chosen.teamId) ?? teams.find(t => t.name === chosen.name) ?? null;
    if (team != null && (team.teamId !== chosen.teamId || team.name !== chosen.name)) {
      this.game.useAsTeamScreen({teamId: team.teamId, name: team.name});
    }
    this.team = team;
    this.missingTeamName = chosen != null && team == null ? chosen.name : null;
  }

  public getTeams(): ITeam[] {
    return this.game.getTeams() ?? [];
  }

  public getColor(team: ITeam): string {
    return TeamColorHelper.getColor(team, this.getTeams());
  }

  public getTextColor(team: ITeam): string {
    return TeamColorHelper.getTextColor(this.getColor(team));
  }

  public chooseTeam(team: ITeam): void {
    this.game.useAsTeamScreen({teamId: team.teamId, name: team.name});
    this.findTeam();
  }

  public changeTeam(): void {
    this.game.useAsTeamScreen(null);
    this.findTeam();
  }
}
