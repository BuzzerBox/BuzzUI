import {Component, EventEmitter, Input, OnChanges, Output, SimpleChanges} from '@angular/core';
import {MatDialog} from '@angular/material/dialog';
import {MatSnackBar} from '@angular/material/snack-bar';
import {tap} from 'rxjs/operators';
import {FileExtensionsService, IStorageEntry, IStorageFolder, IStorageLocation, StorageApiHelper} from '../../../../../shared/shared';
import {IGameRef, StorageService} from '../../services/storage.service';
import {FormatHelper} from '../../helper/format.helper';
import {DialogConfirmComponent, IDialogConfirmData} from '../dialog-confirm/dialog-confirm.component';
import {DialogEditMediaComponent, IDialogEditMediaData, IDialogEditMediaResult} from '../dialog-edit-media/dialog-edit-media.component';

interface IUpload {
  file: File;
  progress: number;
  error?: string;
}

export interface IPickedMedia {
  location: IStorageLocation;
  path: string;
  entry: IStorageEntry;
}

/**
 * Browses media folder by folder: the media of a game, which can be uploaded from this device, organized in folders and
 * deleted, or the other media of a USB stick, which can be picked to copy them into a game
 */
@Component({
    selector: 'app-media-browser',
    templateUrl: './media-browser.component.html',
    styleUrls: ['./media-browser.component.css'],
    standalone: false
})
export class MediaBrowserComponent implements OnChanges {
  /**
   * The game whose media are managed
   */
  @Input() game: IGameRef = null;
  /**
   * Or the USB stick whose other media can be picked
   */
  @Input() stick: IStorageLocation = null;
  @Output() picked = new EventEmitter<IPickedMedia>();

  public readonly acceptedExtensions = FileExtensionsService.getExtensions().join(',');
  public folder: IStorageFolder = null;
  public error: string = null;
  public uploads: IUpload[] = [];
  public newFolderName: string = null;

  constructor(private storage: StorageService, private dialog: MatDialog, private snackBar: MatSnackBar) { }

  ngOnChanges(changes: SimpleChanges): void {
    const gameChanged = changes.game && (changes.game.previousValue?.gameName !== this.game?.gameName
      || changes.game.previousValue?.location.id !== this.game?.location.id);
    const stickChanged = changes.stick && changes.stick.previousValue?.id !== this.stick?.id;
    if (gameChanged || stickChanged) {
      this.uploads = [];
      this.newFolderName = null;
      this.open('');
    }
  }

  public isManaging(): boolean {
    return this.game != null;
  }

  public canWrite(): boolean {
    return this.isManaging() && this.game.location.writable;
  }

  public async open(path: string): Promise<void> {
    if (this.game == null && this.stick == null) {
      this.folder = null;
      return;
    }
    const key = this.getKey();
    try {
      const folder = this.game != null ? await this.storage.listGameMedia(this.game, path) : await this.storage.listStickMedia(this.stick, path);
      if (key === this.getKey()) {
        this.folder = folder;
        this.error = null;
      }
    } catch (e) {
      this.error = StorageService.getErrorMessage(e);
      if (path !== '') {
        // the folder is gone, e.g. deleted from another device
        await this.open('');
      }
    }
  }

  private getKey(): string {
    return this.game != null ? this.game.location.id + '/' + this.game.gameName : this.stick?.id;
  }

  /**
   * The folders from the root to the open one, for the breadcrumbs
   */
  public getBreadcrumbs(): {name: string, path: string}[] {
    const crumbs = [{name: this.game != null ? 'Medien von ' + this.game.gameName : 'USB-Stick ' + this.stick?.name, path: ''}];
    let path = '';
    for (const segment of (this.folder?.path ?? '').split('/').filter(s => s !== '')) {
      path = StorageApiHelper.joinPath(path, segment);
      crumbs.push({name: segment, path});
    }
    return crumbs;
  }

  public getEntryPath(entry: IStorageEntry): string {
    return StorageApiHelper.joinPath(this.folder.path, entry.name);
  }

  public getEntryUrl(entry: IStorageEntry): string {
    return this.game != null
      ? StorageService.getGameMediaUrl(this.game, this.getEntryPath(entry))
      : StorageService.getStickMediaUrl(this.stick, this.getEntryPath(entry));
  }

  public getIcon(entry: IStorageEntry): string {
    if (entry.type === 'directory') {
      return 'folder';
    }
    if (FileExtensionsService.isImage(entry.name)) {
      return 'image';
    }
    return FileExtensionsService.isVideo(entry.name) ? 'movie' : 'audiotrack';
  }

  public getDetails(entry: IStorageEntry): string {
    const date = FormatHelper.formatDateTime(entry.modified);
    return entry.type === 'directory' ? date : `${FormatHelper.formatBytes(entry.size)} · ${date}`;
  }

  public formatBytes(bytes: number): string {
    return FormatHelper.formatBytes(bytes);
  }

  public pick(entry: IStorageEntry): void {
    this.picked.emit({location: this.stick, path: this.getEntryPath(entry), entry});
  }

  /**
   * Uploads the files one after the other into the open folder; files that aren't supported media are skipped
   */
  public async upload(files: FileList | File[]): Promise<void> {
    const game = this.game;
    const folderPath = this.folder?.path ?? '';
    const newUploads: IUpload[] = [];
    for (const file of Array.from(files ?? [])) {
      if (!FileExtensionsService.isSupportedExtension(FileExtensionsService.getExtension(file.name))) {
        this.snackBar.open(`${file.name} wird übersprungen: Nur Bilder, Videos und Audiodateien können hochgeladen werden.`, 'OK', {duration: 6000});
      } else if (!StorageApiHelper.isValidName(file.name)) {
        this.snackBar.open(`${file.name} wird übersprungen: Der Dateiname enthält Zeichen, die ein USB-Stick nicht erlaubt.`, 'OK', {duration: 6000});
      } else {
        newUploads.push({file, progress: 0});
      }
    }
    this.uploads = [...this.uploads.filter(upload => upload.progress < 1 || upload.error != null), ...newUploads];
    for (const upload of newUploads) {
      await this.uploadOne(game, folderPath, upload);
    }
    if (newUploads.length > 0 && game === this.game && folderPath === this.folder?.path) {
      await this.open(folderPath);
    }
  }

  private async uploadOne(game: IGameRef, folderPath: string, upload: IUpload, overwrite = false): Promise<void> {
    try {
      await this.storage.uploadGameMedia(game, folderPath, upload.file, overwrite).pipe(
        tap(progress => upload.progress = progress.progress)
      ).toPromise();
    } catch (e) {
      if (StorageService.isConflict(e) && !overwrite && await this.confirm('Datei ersetzen',
        `In diesem Ordner gibt es schon eine Datei „${upload.file.name}“. Möchtest du sie ersetzen? Alle Fragen, die sie zeigen, zeigen dann die neue.`, 'Ersetzen')) {
        upload.progress = 0;
        return this.uploadOne(game, folderPath, upload, true);
      }
      upload.error = StorageService.isConflict(e) ? 'nicht ersetzt' : StorageService.getErrorMessage(e);
    }
  }

  public dismissUpload(upload: IUpload): void {
    this.uploads = this.uploads.filter(u => u !== upload);
  }

  public startNewFolder(): void {
    this.newFolderName = '';
  }

  public isValidFolderName(name: string): boolean {
    return StorageApiHelper.isValidName(name?.trim() ?? '');
  }

  public async createFolder(): Promise<void> {
    const name = this.newFolderName?.trim();
    if (!this.isValidFolderName(name)) {
      return;
    }
    try {
      await this.storage.createGameMediaFolder(this.game, StorageApiHelper.joinPath(this.folder.path, name));
      this.newFolderName = null;
      await this.open(StorageApiHelper.joinPath(this.folder.path, name));
    } catch (e) {
      this.snackBar.open(StorageService.getErrorMessage(e), 'OK', {duration: 6000});
    }
  }

  /**
   * Renames, moves or deletes a file or folder in a dialog; media a version shows can only be looked at there
   */
  public async edit(entry: IStorageEntry): Promise<void> {
    const result = await this.dialog.open<DialogEditMediaComponent, IDialogEditMediaData, IDialogEditMediaResult>(DialogEditMediaComponent, {
      data: {game: this.game, folderPath: this.folder.path, entry},
      width: '520px'
    }).afterClosed().toPromise();
    if (result) {
      this.snackBar.open(result.action === 'moved' ? `„${result.name}“ wurde gespeichert.` : `„${result.name}“ wurde gelöscht.`, 'OK', {duration: 4000});
      await this.open(this.folder.path);
    }
  }

  private confirm(title: string, message: string, confirmText: string): Promise<boolean> {
    return this.dialog.open<DialogConfirmComponent, IDialogConfirmData, boolean>(DialogConfirmComponent, {
      data: {title, message, confirmText}
    }).afterClosed().toPromise().then(result => !!result);
  }
}
