import {Component, EventEmitter, HostBinding, Input, Output} from '@angular/core';
import {GameService} from '../../../services/game.service';
import {IJeopardyRound, IQuestion, ITeam} from '../../../../../../shared/shared';
import {TeamColorHelper} from '../../../helper/team-color.helper';
import {ScreenThemeHelper} from '../../../themes/screen-theme.helper';

/**
 * The board of the Jeopardy round that is played: the master opens the tile the picking team says and can change who
 * picks; the screens show the tiles that are left and who picks.
 */
@Component({
    selector: 'app-jeopardy-board',
    templateUrl: './jeopardy-board.component.html',
    styleUrls: ['./jeopardy-board.component.css'],
    standalone: false
})
export class JeopardyBoardComponent {
  @Input() isMaster = false;
  @Output() tileOpened = new EventEmitter<IQuestion>();

  @HostBinding('class.screen') get isScreen(): boolean {
    return !this.isMaster;
  }

  // the quiz-show themes, see screen-themes.ts
  @HostBinding('class.show') get isShowStyle(): boolean {
    return this.isScreen && ScreenThemeHelper.isShowStyle(this.game.getGameStateData()?.themeId);
  }

  @HostBinding('style.--categories') get categoryCount(): number {
    return Math.max(1, this.getRound()?.categories.length ?? 1);
  }

  @HostBinding('style.--values') get valueCount(): number {
    return Math.max(1, this.getRound()?.values.length ?? 1);
  }

  constructor(private game: GameService) { }

  public getRound(): IJeopardyRound | undefined {
    return this.game.getCurrentJeopardyRound();
  }

  public isPlayed(question: IQuestion): boolean {
    return this.game.isQuestionPlayed(question.id);
  }

  public open(question: IQuestion): void {
    if (this.isMaster && !this.isPlayed(question)) {
      this.tileOpened.emit(this.game.openTile(question.id));
    }
  }

  public getTeams(): ITeam[] {
    return this.game.getTeams() ?? [];
  }

  public getPickingTeam(): ITeam | undefined {
    return this.game.getPickingTeam();
  }

  public isPicking(team: ITeam): boolean {
    return this.getPickingTeam()?.teamId === team.teamId;
  }

  public choosePickingTeam(team: ITeam): void {
    this.game.setPickingTeam(this.isPicking(team) ? null : team.teamId);
  }

  public getTeamColor(team: ITeam): string {
    return TeamColorHelper.getColor(team, this.getTeams());
  }

  public getTileLabel(categoryName: string, value: number, question: IQuestion): string {
    return `${categoryName}, ${value}${this.isPlayed(question) ? ', gespielt' : ''}`;
  }
}
