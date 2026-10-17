import {Component} from '@angular/core';
import {GameService} from '../../../services/game.service';

/**
 * The master's button to release the buzzers, which stands out while they are locked, and to grade the answer of the
 * team that buzzed
 */
@Component({
    selector: 'app-buzzer-lock',
    templateUrl: './buzzer-lock.component.html',
    styleUrls: ['./buzzer-lock.component.css'],
    standalone: false
})
export class BuzzerLockComponent {

  constructor(private game: GameService) { }

  public isLocked(): boolean {
    return !!this.game.getGameStateData()?.setBuzzerLock;
  }

  /**
   * The team that buzzed, if exactly one is marked
   */
  public getBuzzedTeamName(): string | null {
    const marked = this.game.getGameStateData()?.markedTeamIds ?? [];
    return marked.length === 1 ? this.game.findTeam(marked[0])?.name ?? null : null;
  }

  /**
   * Opens the grade dialog again, see QuestionPaneComponent
   */
  public grade(): void {
    this.game.requestGrading();
  }

  /**
   * Also while they are free, in case the box and the app disagree
   */
  public release(): void {
    this.game.releaseBuzzerLock();
  }
}
