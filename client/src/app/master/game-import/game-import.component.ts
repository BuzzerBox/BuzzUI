import {Component, EventEmitter, Input, Output} from '@angular/core';
import {IGameBundle, IGameImportResult, IStorageLocation, StorageApiHelper} from '../../../../../shared/shared';
import {StorageService} from '../../services/storage.service';
import {GameFileHelper} from '../../helper/game-file.helper';

/**
 * Imports a game file or an old savegame from this device into a location. Old savegames point to their media on the
 * USB sticks; the ones that are plugged in are copied into the game.
 */
@Component({
    selector: 'app-game-import',
    templateUrl: './game-import.component.html',
    styleUrls: ['./game-import.component.css'],
    standalone: false
})
export class GameImportComponent {
  @Input() location: IStorageLocation;
  @Output() imported = new EventEmitter<IGameImportResult>();

  public bundle: IGameBundle = null;
  public gameName = '';
  public error: string = null;
  public importing = false;
  public result: IGameImportResult = null;

  constructor(private storage: StorageService) { }

  public async onFileSelected(files: FileList): Promise<void> {
    this.reset();
    const file = files?.[0];
    if (file == null) {
      return;
    }
    try {
      this.bundle = GameFileHelper.toBundle(JSON.parse(await file.text()), file.name);
      this.gameName = StorageApiHelper.sanitizeName(this.bundle.gameName) || GameFileHelper.getBaseName(file.name);
    } catch (e) {
      this.error = e instanceof SyntaxError ? 'Die Datei ist kein Spiel und kein Spielstand.' : (e as Error).message;
    }
  }

  public getSanitizedName(): string {
    return StorageApiHelper.sanitizeName(this.gameName);
  }

  public async import(): Promise<void> {
    const name = this.getSanitizedName();
    if (!name || this.bundle == null || this.importing) {
      return;
    }
    this.importing = true;
    this.error = null;
    try {
      this.result = await this.storage.importBundle(this.location, name, this.bundle);
      this.bundle = null;
      this.imported.emit(this.result);
    } catch (e) {
      this.error = StorageService.isConflict(e)
        ? `Es gibt schon ein Spiel „${name}“. Wähle einen anderen Namen.`
        : StorageService.getErrorMessage(e);
    } finally {
      this.importing = false;
    }
  }

  public reset(): void {
    this.bundle = null;
    this.error = null;
    this.result = null;
  }
}
