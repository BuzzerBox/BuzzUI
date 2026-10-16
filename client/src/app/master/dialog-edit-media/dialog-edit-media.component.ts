import {Component, Inject, OnInit} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';
import {IStorageEntry, StorageApiHelper} from '../../../../../shared/shared';
import {IGameRef, StorageService} from '../../services/storage.service';

export interface IDialogEditMediaData {
  game: IGameRef;
  // the folder the entry is in, relative to the game's media
  folderPath: string;
  entry: IStorageEntry;
}

export interface IDialogEditMediaResult {
  action: 'moved' | 'deleted';
  name: string;
}

interface IFolderOption {
  path: string;
  name: string;
  depth: number;
}

/**
 * Renames, moves or deletes a file or folder of a game's media. Media that a version shows can't be changed, since
 * versions never change.
 */
@Component({
    selector: 'app-dialog-edit-media',
    template: `
      <h1 mat-dialog-title>{{isFolder() ? 'Ordner' : 'Datei'}} „{{data.entry.name}}“ bearbeiten</h1>
      <div mat-dialog-content>
        @if (isShown()) {
          <p class="shown">
            <mat-icon>lock</mat-icon>
            <span>
              {{getShownText()}} Solange es Versionen gibt, die {{isFolder() ? 'ihn' : 'sie'}} zeigen, lässt
              {{isFolder() ? 'er' : 'sie'}} sich nicht umbenennen, verschieben oder löschen.
            </span>
          </p>
        }

        <mat-form-field class="name">
          <mat-label>Name</mat-label>
          <input matInput [(ngModel)]="name" [disabled]="running || isShown()">
          @if (extension) {
            <!-- the format stays, only the name in front of it changes -->
            <span matTextSuffix>{{extension}}</span>
          }
          @if (getNameProblem(); as problem) {
            <mat-hint class="invalid">{{problem}}</mat-hint>
          }
        </mat-form-field>

        <h3>Ordner</h3>
        @if (folders === null) {
          <mat-spinner diameter="24"></mat-spinner>
        } @else {
          <mat-radio-group class="folders" [(ngModel)]="targetFolder" [disabled]="running || isShown()">
            @for (folder of folders; track folder.path) {
              <mat-radio-button [value]="folder.path" [style.padding-left.px]="folder.depth * 20">
                <mat-icon class="folder-icon">folder</mat-icon>{{folder.name}}
              </mat-radio-button>
            }
          </mat-radio-group>
        }

        @if (error) {
          <p class="error">{{error}}</p>
        }

        <div class="danger">
          @if (!confirmingDelete) {
            <button mat-stroked-button color="warn" [disabled]="running || isShown()" (click)="confirmingDelete = true">
              <mat-icon>delete</mat-icon> {{isFolder() ? 'Ordner' : 'Datei'}} löschen
            </button>
          } @else {
            <p>
              {{isFolder() ? 'Möchtest du den Ordner „' + data.entry.name + '“ mit allen Medien darin löschen?' : 'Möchtest du „' + data.entry.name + '“ löschen?'}}
              Das lässt sich nicht rückgängig machen.
            </p>
            <button mat-button [disabled]="running" (click)="confirmingDelete = false">Doch nicht</button>
            <button mat-flat-button color="warn" [disabled]="running" (click)="delete()">Endgültig löschen</button>
          }
        </div>
      </div>
      <div mat-dialog-actions align="end">
        @if (running) {
          <mat-spinner diameter="24"></mat-spinner>
        }
        <button mat-button mat-dialog-close [disabled]="running">Abbrechen</button>
        <button mat-flat-button color="primary" [disabled]="!canMove()" (click)="move()">{{getActionText()}}</button>
      </div>
    `,
    styles: [`
      .name { width: 100%; }
      .folders { display: flex; flex-direction: column; max-height: 240px; overflow-y: auto; margin-bottom: 12px; }
      .folder-icon { vertical-align: middle; margin-right: 4px; color: rgba(0, 0, 0, 0.54); }
      .shown { display: flex; gap: 8px; align-items: flex-start; padding: 8px 12px; border-radius: 8px; background: #e8eaf6; }
      .shown mat-icon { flex-shrink: 0; color: #3f51b5; }
      .invalid, .error { color: #c62828; }
      .danger { margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(0, 0, 0, 0.12); }
    `],
    standalone: false
})
export class DialogEditMediaComponent implements OnInit {
  // without the extension of a file, which can't be changed
  public name: string;
  // only for files, e.g. ".mp4"
  public readonly extension: string;
  public targetFolder: string;
  public folders: IFolderOption[] = null;
  public running = false;
  public error: string = null;
  public confirmingDelete = false;

  constructor(@Inject(MAT_DIALOG_DATA) public data: IDialogEditMediaData, private storage: StorageService,
              private dialogRef: MatDialogRef<DialogEditMediaComponent, IDialogEditMediaResult>) {
    const dot = data.entry.name.lastIndexOf('.');
    this.extension = data.entry.type === 'file' && dot > 0 ? data.entry.name.substring(dot) : '';
    this.name = this.extension ? data.entry.name.substring(0, dot) : data.entry.name;
    this.targetFolder = data.folderPath;
  }

  async ngOnInit(): Promise<void> {
    // folder by folder, since the media tree leaves out empty folders, which are targets too
    const options: IFolderOption[] = [{path: '', name: 'Medien von ' + this.data.game.gameName, depth: 0}];
    const collect = async (folderPath: string, depth: number) => {
      for (const entry of (await this.storage.listGameMedia(this.data.game, folderPath)).entries) {
        const entryPath = StorageApiHelper.joinPath(folderPath, entry.name);
        // a folder can't go into itself
        if (entry.type === 'directory' && entryPath !== this.getPath()) {
          options.push({path: entryPath, name: entry.name, depth});
          await collect(entryPath, depth + 1);
        }
      }
    };
    try {
      await collect('', 1);
    } catch (e) {
      this.error = StorageService.getErrorMessage(e);
    }
    this.folders = options;
  }

  public isFolder(): boolean {
    return this.data.entry.type === 'directory';
  }

  public isShown(): boolean {
    return (this.data.entry.usedByVersions?.length ?? 0) > 0;
  }

  public getShownText(): string {
    const versions = this.data.entry.usedByVersions;
    const which = versions.length === 1 ? `Version ${versions[0]}` : `Die Versionen ${versions.join(', ')}`;
    return this.isFolder() ? `${which} ${versions.length === 1 ? 'zeigt' : 'zeigen'} Medien aus diesem Ordner.`
      : `${which} ${versions.length === 1 ? 'zeigt' : 'zeigen'} diese Datei.`;
  }

  private getPath(): string {
    return StorageApiHelper.joinPath(this.data.folderPath, this.data.entry.name);
  }

  public getNameProblem(): string | null {
    if (!this.name || !StorageApiHelper.isValidName(this.getNewName())) {
      return 'Der Name darf nicht leer sein, nicht mit „.“ beginnen und keines dieser Zeichen enthalten: \\ / : * ? " < > | # %';
    }
    return null;
  }

  private getNewName(): string {
    return this.name + this.extension;
  }

  private getTargetPath(): string {
    return StorageApiHelper.joinPath(this.targetFolder, this.getNewName());
  }

  public getActionText(): string {
    const isRenamed = this.getNewName() !== this.data.entry.name;
    const isMoved = this.targetFolder !== this.data.folderPath;
    return isMoved && isRenamed ? 'Verschieben und umbenennen' : isMoved ? 'Verschieben' : 'Umbenennen';
  }

  public canMove(): boolean {
    return !this.running && !this.isShown() && this.getNameProblem() === null && this.getTargetPath() !== this.getPath();
  }

  public async move(): Promise<void> {
    if (!this.canMove()) {
      return;
    }
    await this.run(async () => {
      await this.storage.moveGameMedia(this.data.game, this.getPath(), this.getTargetPath());
      this.dialogRef.close({action: 'moved', name: this.getNewName()});
    }, `Dort gibt es schon „${this.getNewName()}“, oder eine Version zeigt es inzwischen.`);
  }

  public async delete(): Promise<void> {
    await this.run(async () => {
      await this.storage.deleteGameMedia(this.data.game, this.getPath());
      this.dialogRef.close({action: 'deleted', name: this.data.entry.name});
    }, 'Eine Version des Spiels zeigt es inzwischen.');
  }

  private async run(action: () => Promise<void>, conflictMessage: string): Promise<void> {
    this.running = true;
    this.error = null;
    this.dialogRef.disableClose = true;
    try {
      await action();
    } catch (e) {
      this.error = StorageService.isConflict(e) ? conflictMessage : StorageService.getErrorMessage(e);
    } finally {
      this.running = false;
      this.dialogRef.disableClose = false;
    }
  }
}
