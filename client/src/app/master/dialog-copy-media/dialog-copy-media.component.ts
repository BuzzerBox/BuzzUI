import {t} from '../../i18n/i18n';
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
      <h1 mat-dialog-title>{{'copyMedia.title' | transloco}}</h1>
      <div mat-dialog-content>
        <p class="hint">{{'copyMedia.hint' | transloco: {game: data.game.gameName} }}</p>
        <app-storage-locations [usbOnly]="true" (selectedChange)="stick = $event"></app-storage-locations>
        @if (stick) {
          <app-media-browser [stick]="stick" (picked)="copy($event)"></app-media-browser>
        }
      </div>
      <div mat-dialog-actions align="end">
        @if (copying) {
          <mat-spinner diameter="24"></mat-spinner>
        }
        <button mat-flat-button color="primary" mat-dialog-close>{{'copyMedia.done' | transloco}}</button>
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
      this.snackBar.open(t('copyMedia.copied', {name: entry.name}), t('common.ok'), {duration: 4000});
    } catch (e) {
      this.snackBar.open(t('copyMedia.failed', {name: picked.entry.name, error: StorageService.getErrorMessage(e)}), t('common.ok'), {duration: 6000});
    } finally {
      this.copying = false;
    }
  }
}
