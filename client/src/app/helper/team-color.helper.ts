import {ITeam} from '../../../../shared/shared';
import {ConfigService} from '../services/config.service';

/**
 * The colors of the teams on the screens. Each buzzer has one, so a team keeps its color in a continued game; a buzzer
 * in the config can set its own ("color": "#rrggbb"), e.g. to match the color of its cap. Red and green are left out,
 * since they stand for wrong and right answers.
 */
export class TeamColorHelper {
  public static readonly PALETTE = [
    '#4f8ef7', '#ffb020', '#b46cff', '#18c5c5', '#ff6fb5',
    '#ff8a3d', '#8bd450', '#6c7dff', '#f2e14c', '#c08457'
  ];

  private constructor() {
    // avoid instantiation
  }

  /**
   * @param teams all teams, for teams without a buzzerIndex (they sit on the buzzers in order)
   */
  public static getColor(team: ITeam, teams: ITeam[] = []): string {
    const index = team.buzzerIndex ?? Math.max(0, teams.findIndex(t => t.teamId === team.teamId));
    const buzzer = ConfigService.get().buzzers[index] as {color?: string} | undefined;
    return buzzer?.color ?? this.PALETTE[index % this.PALETTE.length];
  }
}
