import {IBuzzer, ITeam} from '../../../../shared/shared';
import {ConfigService} from '../services/config.service';

/**
 * The colors of the teams on the screens. Each buzzer has one, so a team keeps its color in a continued game: a wireless
 * buzzer the color of its case (given when it was adopted), a buzzer of the box the one in the config ("color":
 * "#rrggbb", e.g. to match the color of its cap). The server puts it on the team (ITeam.color). A buzzer without one gets
 * a color of the palette by its index; red and green are left out there, since they stand for wrong and right answers.
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
    if (team.color) {
      return team.color;
    }
    const index = team.buzzerIndex ?? Math.max(0, teams.findIndex(t => t.teamId === team.teamId));
    return this.getColorByIndex(index);
  }

  /**
   * The color a team on this buzzer gets
   * @param buzzerIndex its position in the available buzzers
   */
  public static getBuzzerColor(buzzer: IBuzzer, buzzerIndex: number): string {
    return buzzer?.color || this.getColorByIndex(buzzerIndex);
  }

  private static getColorByIndex(index: number): string {
    const buzzer = ConfigService.get().buzzers[index] as {color?: string} | undefined;
    return buzzer?.color ?? this.PALETTE[index % this.PALETTE.length];
  }
}
