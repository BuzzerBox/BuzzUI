import {Component} from '@angular/core';
import {MatDialog} from '@angular/material/dialog';
import {GameService} from '../../../services/game.service';
import {openReleaseConfirmation} from '../dialogs/release-confirmation';

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

  constructor(private game: GameService, private dialog: MatDialog) { }

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
   * Also while they are free, in case the box and the app disagree; that doesn't need to be confirmed
   */
  public release(): void {
    if (!this.isLocked()) {
      this.game.releaseBuzzerLock();
      return;
    }
    const markedBefore = this.getMarkedTeamIds();
    openReleaseConfirmation(this.dialog, this.getBuzzedTeamName()).afterClosed().subscribe(confirmed => {
      // the buzzers may have been released and another team may have buzzed meanwhile, e.g. from the box
      if (confirmed && this.isLocked() && this.getMarkedTeamIds() === markedBefore) {
        this.game.releaseBuzzerLock();
      }
    });
  }

  private getMarkedTeamIds(): string {
    return (this.game.getGameStateData()?.markedTeamIds ?? []).join(',');
  }
}
