import {Component, HostBinding, Input, OnInit} from '@angular/core';
import {GameService} from '../../../services/game.service';
import {ITeam} from '../../../../../../shared/shared';
import {TeamColorHelper} from '../../../helper/team-color.helper';
import {ScreenThemeHelper} from '../../../themes/screen-theme.helper';

interface IRankedTeam {
  team: ITeam;
  // teams with the same points share their place
  place: number;
  color: string;
  // the position on the podium from the left: 2nd, 1st, 3rd
  order?: number;
}

interface IConfettiPiece {
  left: number;
  color: string;
  delay: number;
  duration: number;
  drift: number;
}

@Component({
    selector: 'app-score-board',
    templateUrl: './score-board.component.html',
    styleUrls: ['./score-board.component.css'],
    standalone: false
})
export class ScoreBoardComponent implements OnInit {
  private static readonly PODIUM_SIZE = 3;
  private static readonly CONFETTI_PIECES = 60;

  @Input() isMaster = false;

  @HostBinding('class.screen') get isScreen(): boolean {
    return !this.isMaster;
  }

  // the quiz-show themes show a podium, see screen-themes.ts
  @HostBinding('class.show') get isShowStyle(): boolean {
    return this.isScreen && ScreenThemeHelper.isShowStyle(this.game.getGameStateData()?.themeId);
  }

  public sortedTeams: ITeam[] = [];
  // screens: the first three on a podium, the others below it
  public podium: IRankedTeam[] = [];
  public others: IRankedTeam[] = [];
  public confetti: IConfettiPiece[] = [];

  constructor(private game: GameService) { }

  ngOnInit(): void {
    this.sortedTeams = this.game.getTeamsOrderedByScore();
    if (this.isShowStyle) {
      const ranked = ScoreBoardComponent.rank(this.sortedTeams, this.game.getTeams() ?? []);
      this.podium = ScoreBoardComponent.arrangePodium(ranked.slice(0, ScoreBoardComponent.PODIUM_SIZE));
      this.others = ranked.slice(ScoreBoardComponent.PODIUM_SIZE);
      this.confetti = ScoreBoardComponent.makeConfetti(this.podium.map(entry => entry.color));
    }
  }

  /**
   * @param sortedTeams with the most points first
   */
  public static rank(sortedTeams: ITeam[], allTeams: ITeam[]): IRankedTeam[] {
    return sortedTeams.map(team => ({
      team,
      place: 1 + sortedTeams.filter(other => (other.points ?? 0) > (team.points ?? 0)).length,
      color: TeamColorHelper.getColor(team, allTeams)
    }));
  }

  /**
   * The winner in the middle, the second left of it and the third right of it
   */
  public static arrangePodium(firstThree: IRankedTeam[]): IRankedTeam[] {
    const order = [2, 1, 3];
    return firstThree.map((entry, i) => ({...entry, order: order[i]}));
  }

  public resetServer(): void {
    this.game.resetServer();
  }

  private static makeConfetti(colors: string[]): IConfettiPiece[] {
    const palette = [...colors, '#ffc940', '#ffffff', '#ff6659'];
    return Array.from({length: this.CONFETTI_PIECES}, (_, i) => ({
      left: Math.random() * 100,
      color: palette[i % palette.length],
      delay: Math.random() * 1200,
      duration: 2600 + Math.random() * 1800,
      drift: (Math.random() - 0.5) * 30
    }));
  }

}
