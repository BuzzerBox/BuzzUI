import {Component} from '@angular/core';
import {MatDialog} from '@angular/material/dialog';
import {GameService} from '../../../../services/game.service';

@Component({
    selector: 'app-dialog-confirm-ending-game',
    templateUrl: './dialog-confirm-ending-game.component.html',
    styleUrls: ['./dialog-confirm-ending-game.component.css'],
    standalone: false
})
export class DialogConfirmEndingGameComponent {

  /**
   * Asks whether to end the game, and ends it if so; from the master's menu and after the last question
   */
  public static confirmAndEndGame(dialog: MatDialog, game: GameService): void {
    dialog.open(DialogConfirmEndingGameComponent).afterClosed().subscribe(confirmed => {
      if (confirmed) {
        game.endGame();
      }
    });
  }

}
