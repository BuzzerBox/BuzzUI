import {Component, ViewChild} from '@angular/core';
import {IStorageLocation} from '../../../../../shared/shared';
import {GameService} from '../../services/game.service';
import {GameListComponent} from '../game-list/game-list.component';
import {StorageLocationsComponent} from '../storage-locations/storage-locations.component';

/**
 * Manages the games on the box and the USB sticks: their versions, states and media
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

  constructor(game: GameService) {
    game.useAsMaster();
  }

  public onImported(): void {
    this.gameList?.reload();
    this.locations?.refresh();
  }
}
