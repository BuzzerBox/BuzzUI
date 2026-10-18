import {Component} from '@angular/core';
import {GameService} from '../../../services/game.service';
import {EGradeResults, ITeam} from '../../../../../../shared/shared';

/**
 * For the master: grades the teams that wagered, the one that picked the Daily Double or every team in the final. Each
 * wins or loses its wager.
 */
@Component({
    selector: 'app-wager-grading',
    templateUrl: './wager-grading.component.html',
    styleUrls: ['./wager-grading.component.css'],
    standalone: false
})
export class WagerGradingComponent {
  constructor(private game: GameService) { }

  public getTeams(): ITeam[] {
    return this.game.getTeamsGradedByWager();
  }

  public getWager(team: ITeam): number {
    return this.game.getWager(team.teamId) ?? 0;
  }

  public mayGrade(team: ITeam): boolean {
    return this.game.mayGrade(team.teamId);
  }

  public grade(team: ITeam, isCorrect: boolean): void {
    this.game.gradeWager(team.teamId, isCorrect);
  }

  /**
   * How the team was graded in the final, e.g. "Richtig, +300"; null if not yet, and on a Daily Double
   */
  public getResult(team: ITeam): string | null {
    const result = this.game.getFinalGradeResult(team.teamId);
    if (result == null) {
      return null;
    }
    const wager = this.getWager(team);
    if (wager === 0) {
      return result === EGradeResults.WRONG ? 'Falsch, 0' : 'Richtig, 0';
    }
    return result === EGradeResults.WRONG ? `Falsch, −${wager}` : `Richtig, +${wager}`;
  }
}
