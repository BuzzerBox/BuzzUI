import {Component, EventEmitter, Input, OnDestroy, Output} from '@angular/core';
import {Subscription} from 'rxjs';
import {GameFormatHelper, IGameBundle, IGameImportResult, IStorageLocation, StorageApiHelper} from '../../../../../shared/shared';
import {StorageService} from '../../services/storage.service';
import {GameFileHelper} from '../../helper/game-file.helper';
import {FormatHelper} from '../../helper/format.helper';

/**
 * Imports a game from this device into a location: an archive of a whole game with its media (downloaded from a box), a
 * game file without media, or an old savegame. Old savegames point to their media on the USB sticks; the ones that are
 * plugged in are copied into the game.
 */
@Component({
    selector: 'app-game-import',
    templateUrl: './game-import.component.html',
    styleUrls: ['./game-import.component.css'],
    standalone: false
})
export class GameImportComponent implements OnDestroy {
  @Input() location: IStorageLocation;
  @Output() imported = new EventEmitter<IGameImportResult>();

  public bundle: IGameBundle = null;
  public archive: File = null;
  // while an archive is uploaded, from 0 to 1
  public uploadProgress: number = null;
  private upload: Subscription;
  public gameName = '';
  public error: string = null;
  public importing = false;
  public result: IGameImportResult = null;

  constructor(private storage: StorageService) { }

  ngOnDestroy(): void {
    this.upload?.unsubscribe();
  }

  public async onFileSelected(files: FileList): Promise<void> {
    this.reset();
    const file = files?.[0];
    if (file == null) {
      return;
    }
    if (GameFileHelper.isArchive(file.name)) {
      this.archive = file;
      this.gameName = GameFileHelper.getBaseName(file.name);
      return;
    }
    try {
      this.bundle = GameFileHelper.toBundle(JSON.parse(await file.text()), file.name);
      this.gameName = StorageApiHelper.sanitizeName(this.bundle.gameName) || GameFileHelper.getBaseName(file.name);
    } catch (e) {
      this.error = e instanceof SyntaxError ? 'Die Datei ist kein Spiel und kein Spielstand.' : (e as Error).message;
    }
  }

  /**
   * E.g. "12 Fragen", and for a bundle with a state "und ein Spielstand (3 Teams, Frage 4 von 12)"
   */
  public getBundleSummary(): string {
    const rounds = this.bundle.game.rounds;
    const questionCount = GameFormatHelper.getAllQuestions(rounds).length;
    const contents = rounds.length > 1 ? `${rounds.length} Runden, ${questionCount} Fragen` : `${questionCount} Fragen`;
    const state = this.bundle.state;
    if (state == null) {
      return contents;
    }
    const progress = GameFormatHelper.describeProgress(GameFormatHelper.getProgress(rounds, state.gameState));
    return `${contents} und ein Spielstand (${state.teams.length} Teams, ${progress})`;
  }

  public getSanitizedName(): string {
    return StorageApiHelper.sanitizeName(this.gameName);
  }

  public getArchiveSize(): string {
    return FormatHelper.formatBytes(this.archive.size);
  }

  public getPercent(): string {
    return Math.round(this.uploadProgress * 100) + ' %';
  }

  public async import(): Promise<void> {
    const name = this.getSanitizedName();
    if (this.archive != null && name && !this.importing) {
      this.importArchive(name);
      return;
    }
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

  private importArchive(name: string): void {
    this.importing = true;
    this.error = null;
    this.uploadProgress = 0;
    this.upload = this.storage.importGameArchive(this.location, name, this.archive).subscribe({
      next: progress => {
        this.uploadProgress = progress.progress;
        if (progress.result) {
          this.result = progress.result;
          this.archive = null;
          this.imported.emit(this.result);
        }
      },
      error: e => {
        this.error = StorageService.isConflict(e)
          ? `Es gibt schon ein Spiel „${name}“. Wähle einen anderen Namen.`
          : StorageService.getErrorMessage(e);
        this.importing = false;
        this.uploadProgress = null;
      },
      complete: () => {
        this.importing = false;
        this.uploadProgress = null;
      }
    });
  }

  public reset(): void {
    this.upload?.unsubscribe();
    this.importing = false;
    this.archive = null;
    this.uploadProgress = null;
    this.bundle = null;
    this.error = null;
    this.result = null;
  }
}
