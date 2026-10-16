import {Component} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {IStorageLocation} from '../../../../../shared/shared';
import {GameService} from '../../services/game.service';
import {TGameListMode} from '../game-list/game-list.component';

/**
 * Chooses a stored game to start anew (mode=new, the default), or a state to continue (mode=continue)
 */
@Component({
    selector: 'app-load-game',
    templateUrl: './load-game.component.html',
    styleUrls: ['./load-game.component.css'],
    standalone: false
})
export class LoadGameComponent {
  public location: IStorageLocation = null;
  public readonly mode: TGameListMode;

  constructor(game: GameService, route: ActivatedRoute) {
    game.useAsMaster();
    this.mode = route.snapshot.queryParamMap.get('mode') === 'continue' ? 'continue' : 'new';
  }
}
