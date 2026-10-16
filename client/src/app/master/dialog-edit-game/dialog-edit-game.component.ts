import {Component, Inject, OnInit} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';
import {IGameInfo, IStorageLocation, StorageApiHelper} from '../../../../../shared/shared';
import {StorageService} from '../../services/storage.service';
import {FormatHelper} from '../../helper/format.helper';

export interface IDialogEditGameData {
  game: IGameInfo;
  location: IStorageLocation;
}

export interface IDialogEditGameResult {
  action: 'renamed' | 'moved' | 'copied' | 'deleted';
  name: string;
  to: IStorageLocation;
  // a move whose original couldn't be removed afterwards, so the game was copied
  originalKept?: boolean;
}

/**
 * Renames, moves or copies a game with its versions, states and media, within its location or to another one, or
 * deletes it
 */
@Component({
    selector: 'app-dialog-edit-game',
    template: `
      <h1 mat-dialog-title>„{{data.game.name}}“ bearbeiten</h1>
      <div mat-dialog-content>
        <mat-form-field class="name">
          <mat-label>Name</mat-label>
          <input matInput [(ngModel)]="name" [disabled]="running">
          @if (!isValidName()) {
            <mat-hint class="invalid">Der Name darf nicht leer sein und keines dieser Zeichen enthalten: \\ / : * ? " &lt; &gt; | # %</mat-hint>
          }
        </mat-form-field>

        <h3>Ort</h3>
        @if (locations === null) {
          <mat-spinner diameter="24"></mat-spinner>
        } @else {
          <mat-radio-group class="locations" [(ngModel)]="targetId" [disabled]="running">
            @for (location of locations; track location.id) {
              <mat-radio-button [value]="location.id" [disabled]="!location.writable">
                {{getLabel(location)}}
                <span class="detail">{{location.id === data.location.id ? 'jetziger Ort' : getSpace(location)}}</span>
              </mat-radio-button>
            }
          </mat-radio-group>
        }

        <mat-button-toggle-group [(ngModel)]="move" [disabled]="running" aria-label="Verschieben oder kopieren">
          <mat-button-toggle [value]="true" [disabled]="!data.location.writable">{{isSameLocation() ? 'Umbenennen' : 'Verschieben'}}</mat-button-toggle>
          <mat-button-toggle [value]="false">Kopieren</mat-button-toggle>
        </mat-button-toggle-group>
        <p class="hint">{{getExplanation()}}</p>

        @if (error) {
          <p class="error">{{error}}</p>
        }

        @if (data.location.writable) {
          <div class="danger">
            @if (!confirmingDelete) {
              <button mat-stroked-button color="warn" [disabled]="running" (click)="confirmingDelete = true">
                <mat-icon>delete</mat-icon> Spiel löschen
              </button>
            } @else {
              <p>
                Möchtest du „{{data.game.name}}“ mit {{getVersionCount()}}, {{getStateCount()}} und allen Medien löschen?
                Das lässt sich nicht rückgängig machen.
              </p>
              <button mat-button [disabled]="running" (click)="confirmingDelete = false">Doch nicht</button>
              <button mat-flat-button color="warn" [disabled]="running" (click)="delete()">Endgültig löschen</button>
            }
          </div>
        }
      </div>
      <div mat-dialog-actions align="end">
        @if (running) {
          <mat-spinner diameter="24"></mat-spinner>
        }
        <button mat-button mat-dialog-close [disabled]="running">Abbrechen</button>
        <button mat-flat-button color="primary" [disabled]="!canStart()" (click)="start()">{{getActionText()}}</button>
      </div>
    `,
    styles: [`
      .name { width: 100%; }
      .locations { display: flex; flex-direction: column; margin-bottom: 12px; }
      .detail { margin-left: 8px; font-size: 0.85em; color: rgba(0, 0, 0, 0.6); }
      .hint { color: rgba(0, 0, 0, 0.6); }
      .invalid, .error { color: #c62828; }
      .danger { margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(0, 0, 0, 0.12); }
    `],
    standalone: false
})
export class DialogEditGameComponent implements OnInit {
  public name: string;
  public move: boolean;
  public locations: IStorageLocation[] = null;
  public targetId: string;
  public running = false;
  public error: string = null;
  public confirmingDelete = false;

  constructor(@Inject(MAT_DIALOG_DATA) public data: IDialogEditGameData, private storage: StorageService,
              private dialogRef: MatDialogRef<DialogEditGameComponent, IDialogEditGameResult>) {
    this.name = data.game.name;
    this.move = data.location.writable;
    this.targetId = data.location.id;
  }

  async ngOnInit(): Promise<void> {
    try {
      this.locations = await this.storage.getLocations();
      // a game on a read-only stick can only be copied elsewhere
      if (!this.data.location.writable) {
        this.targetId = this.locations.find(location => location.writable)?.id ?? null;
      }
    } catch (e) {
      this.locations = [this.data.location];
      this.error = StorageService.getErrorMessage(e);
    }
  }

  public getLabel(location: IStorageLocation): string {
    return StorageService.getLocationLabel(location);
  }

  public getSpace(location: IStorageLocation): string {
    if (!location.writable) {
      return 'schreibgeschützt';
    }
    return location.freeBytes != null ? FormatHelper.formatBytes(location.freeBytes) + ' frei' : '';
  }

  public isSameLocation(): boolean {
    return this.targetId === this.data.location.id;
  }

  public isValidName(): boolean {
    return StorageApiHelper.isValidName(this.name);
  }

  public getExplanation(): string {
    const here = StorageService.getLocationText(this.data.location);
    if (this.isSameLocation()) {
      return this.move
        ? 'Das Spiel bekommt einen neuen Namen und bleibt mit allen Versionen, Spielständen und Medien, wo es ist.'
        : `Auf ${here} entsteht eine Kopie mit allen Versionen, Spielständen und Medien unter dem neuen Namen.`;
    }
    return this.move
      ? `Das Spiel kommt mit allen Versionen, Spielständen und Medien an den neuen Ort und wird von ${here} gelöscht.`
      : `Das Spiel bleibt auf ${here}, und eine Kopie mit allen Versionen, Spielständen und Medien kommt an den neuen Ort.`;
  }

  public getActionText(): string {
    if (this.isSameLocation()) {
      return this.move ? 'Umbenennen' : 'Kopie anlegen';
    }
    return this.move ? 'Verschieben' : 'Kopieren';
  }

  public canStart(): boolean {
    return !this.running && this.targetId != null && this.isValidName()
      && !(this.isSameLocation() && this.name === this.data.game.name);
  }

  public getVersionCount(): string {
    return this.data.game.versions.length === 1 ? 'einer Version' : `${this.data.game.versions.length} Versionen`;
  }

  public getStateCount(): string {
    return this.data.game.states.length === 1 ? 'einem Spielstand' : `${this.data.game.states.length} Spielständen`;
  }

  public async start(): Promise<void> {
    const to = this.locations.find(location => location.id === this.targetId);
    if (!this.canStart() || to == null) {
      return;
    }
    const action = this.isSameLocation() ? (this.move ? 'renamed' : 'copied') : (this.move ? 'moved' : 'copied');
    await this.run(async () => {
      const copy = await this.storage.copyGame({location: this.data.location, gameName: this.data.game.name}, to, this.name, this.move);
      this.dialogRef.close({action: copy.originalKept ? 'copied' : action, name: this.name, to, originalKept: copy.originalKept});
    }, `Auf ${StorageService.getLocationText(to)} gibt es schon ein Spiel „${this.name}“, oder das Spiel wird gerade gespielt. Wähle einen anderen Namen.`);
  }

  public async delete(): Promise<void> {
    await this.run(async () => {
      await this.storage.deleteGame({location: this.data.location, gameName: this.data.game.name});
      this.dialogRef.close({action: 'deleted', name: this.data.game.name, to: this.data.location});
    }, 'Das Spiel wird gerade gespielt und lässt sich deshalb nicht löschen.');
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
