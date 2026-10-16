import {Component, ViewChild} from '@angular/core';
import {Router} from '@angular/router';
import {IStorageLocation} from '../../../../../shared/shared';
import {GameService} from '../../services/game.service';
import {GameListComponent} from '../game-list/game-list.component';
import {StorageLocationsComponent} from '../storage-locations/storage-locations.component';
import {INewGameNavigationState} from '../game-navigation';
import {baseUrlMaster, pathsMaster} from '../paths-master';

/**
 * Manages the games on the box and the USB sticks: creates them, and manages their versions, states and media
 */
@Component({
    selector: 'app-storage-manager',
    templateUrl: './storage-manager.component.html',
    styleUrls: ['./storage-manager.component.css'],
    standalone: false
})
export class StorageManagerComponent {
  @ViewChild(StorageLocationsComponent) locations: StorageLocationsComponent;
  @ViewChild(GameListComponent) gameList: GameListComponent;
  public location: IStorageLocation = null;

  constructor(game: GameService, private router: Router) {
    game.useAsMaster();
  }

  /**
   * Opens the editor for a new game on the chosen location
   */
  public createGame(): void {
    const state: INewGameNavigationState = {newGameLocationId: this.location.id};
    this.router.navigate([baseUrlMaster + pathsMaster.setup], {state});
  }

  public onImported(): void {
    this.gameList?.reload();
    this.locations?.refresh();
  }
}
