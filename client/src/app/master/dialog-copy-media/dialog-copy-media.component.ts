import {Component, Inject} from '@angular/core';
import {MAT_DIALOG_DATA} from '@angular/material/dialog';
import {MatSnackBar} from '@angular/material/snack-bar';
import {IStorageLocation} from '../../../../../shared/shared';
import {IGameRef, StorageService} from '../../services/storage.service';
import {IPickedMedia} from '../media-browser/media-browser.component';

export interface IDialogCopyMediaData {
  game: IGameRef;
}

/**
 * Copies media from a USB stick into a game, so the game has everything it shows in its own folder
 */
@Component({
    selector: 'app-dialog-copy-media',
    template: `
      <h1 mat-dialog-title>Medien vom USB-Stick übernehmen</h1>
      <div mat-dialog-content>
        <p class="hint">Übernommene Dateien und Ordner werden in die Medien von „{{data.game.gameName}}“ kopiert.</p>
        <app-storage-locations [usbOnly]="true" (selectedChange)="stick = $event"></app-storage-locations>
        @if (stick) {
          <app-media-browser [stick]="stick" (picked)="copy($event)"></app-media-browser>
        }
      </div>
      <div mat-dialog-actions align="end">
        @if (copying) {
          <mat-spinner diameter="24"></mat-spinner>
        }
        <button mat-flat-button color="primary" mat-dialog-close>Fertig</button>
      </div>
    `,
    styles: ['.hint { color: rgba(0, 0, 0, 0.6); }'],
    standalone: false
})
export class DialogCopyMediaComponent {
  public stick: IStorageLocation = null;
  public copying = false;

  constructor(@Inject(MAT_DIALOG_DATA) public data: IDialogCopyMediaData, private storage: StorageService, private snackBar: MatSnackBar) { }

  public async copy(picked: IPickedMedia): Promise<void> {
    if (this.copying) {
      return;
    }
    this.copying = true;
    try {
      const entry = await this.storage.copyIntoGame(this.data.game, '', picked.location, picked.path);
      this.snackBar.open(`„${entry.name}“ wurde übernommen.`, 'OK', {duration: 4000});
    } catch (e) {
      this.snackBar.open(`„${picked.entry.name}“ konnte nicht übernommen werden: ${StorageService.getErrorMessage(e)}`, 'OK', {duration: 6000});
    } finally {
      this.copying = false;
    }
  }
}
