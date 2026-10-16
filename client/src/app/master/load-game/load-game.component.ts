import {Component, ViewChild} from '@angular/core';
import {IStorageLocation} from '../../../../../shared/shared';
import {GameService} from '../../services/game.service';
import {GameListComponent} from '../game-list/game-list.component';

/**
 * Chooses a stored game to start anew, or one of its states to continue
 */
@Component({
    selector: 'app-load-game',
    templateUrl: './load-game.component.html',
    styleUrls: ['./load-game.component.css'],
    standalone: false
})
export class LoadGameComponent {
  @ViewChild(GameListComponent) gameList: GameListComponent;
  public location: IStorageLocation = null;

  constructor(game: GameService) {
    game.useAsMaster();
  }
}
