import {Component, Inject} from '@angular/core';
import {MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';
import {IGameStateInfo, StorageApiHelper} from '../../../../../shared/shared';
import {IGameRef, StorageService} from '../../services/storage.service';

export interface IDialogEditStateData {
  game: IGameRef;
  state: IGameStateInfo;
}

export interface IDialogEditStateResult {
  action: 'renamed' | 'deleted';
  name: string;
}

/**
 * Renames or deletes a state of a game
 */
@Component({
    selector: 'app-dialog-edit-state',
    template: `
      <h1 mat-dialog-title>Spielstand „{{data.state.name}}“ bearbeiten</h1>
      <div mat-dialog-content>
        <form (ngSubmit)="rename()">
          <mat-form-field class="name">
            <mat-label>Name</mat-label>
            <input matInput name="stateName" [(ngModel)]="name" [disabled]="running">
            @if (!isValidName()) {
              <mat-hint class="invalid">Der Name darf nicht leer sein und keines dieser Zeichen enthalten: \\ / : * ? " &lt; &gt; | # %</mat-hint>
            }
          </mat-form-field>
        </form>

        @if (error) {
          <p class="error">{{error}}</p>
        }

        <div class="danger">
          @if (!confirmingDelete) {
            <button mat-stroked-button color="warn" [disabled]="running" (click)="confirmingDelete = true">
              <mat-icon>delete</mat-icon> Spielstand löschen
            </button>
          } @else {
            <p>Möchtest du den Spielstand „{{data.state.name}}“ löschen? Das lässt sich nicht rückgängig machen.</p>
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
        <button mat-flat-button color="primary" [disabled]="!canRename()" (click)="rename()">Umbenennen</button>
      </div>
    `,
    styles: [`
      .name { width: 100%; }
      .invalid, .error { color: #c62828; }
      .danger { margin-top: 16px; padding-top: 16px; border-top: 1px solid rgba(0, 0, 0, 0.12); }
    `],
    standalone: false
})
export class DialogEditStateComponent {
  public name: string;
  public running = false;
  public error: string = null;
  public confirmingDelete = false;

  constructor(@Inject(MAT_DIALOG_DATA) public data: IDialogEditStateData, private storage: StorageService,
              private dialogRef: MatDialogRef<DialogEditStateComponent, IDialogEditStateResult>) {
    this.name = data.state.name;
  }

  public isValidName(): boolean {
    return StorageApiHelper.isValidName(this.name);
  }

  public canRename(): boolean {
    return !this.running && this.isValidName() && this.name !== this.data.state.name;
  }

  public async rename(): Promise<void> {
    if (!this.canRename()) {
      return;
    }
    await this.run(async () => {
      await this.storage.renameState(this.data.game, this.data.state.name, this.name);
      this.dialogRef.close({action: 'renamed', name: this.name});
    }, `Es gibt schon einen Spielstand „${this.name}“, oder dieser wird gerade gespielt.`);
  }

  public async delete(): Promise<void> {
    await this.run(async () => {
      await this.storage.deleteState(this.data.game, this.data.state.name);
      this.dialogRef.close({action: 'deleted', name: this.data.state.name});
    }, 'Der Spielstand wird gerade gespielt und lässt sich deshalb nicht löschen.');
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
