import {t} from '../../i18n/i18n';
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
      <h1 mat-dialog-title>{{'editState.title' | transloco: {name: data.state.name} }}</h1>
      <div mat-dialog-content>
        <form (ngSubmit)="rename()">
          <mat-form-field class="name">
            <mat-label>{{'common.name' | transloco}}</mat-label>
            <input matInput name="stateName" [(ngModel)]="name" [disabled]="running">
            @if (!isValidName()) {
              <mat-hint class="invalid">{{'common.invalidName' | transloco}}</mat-hint>
            }
          </mat-form-field>
        </form>

        @if (error) {
          <p class="error">{{error}}</p>
        }

        <div class="danger">
          @if (!confirmingDelete) {
            <button mat-stroked-button color="warn" [disabled]="running" (click)="confirmingDelete = true">
              <mat-icon>delete</mat-icon> {{'editState.delete' | transloco}}
            </button>
          } @else {
            <p>{{'editState.confirmDelete' | transloco: {name: data.state.name} }} {{'common.cannotUndo' | transloco}}</p>
            <button mat-button [disabled]="running" (click)="confirmingDelete = false">{{'common.keep' | transloco}}</button>
            <button mat-flat-button color="warn" [disabled]="running" (click)="delete()">{{'common.deleteForever' | transloco}}</button>
          }
        </div>
      </div>
      <div mat-dialog-actions align="end">
        @if (running) {
          <mat-spinner diameter="24"></mat-spinner>
        }
        <button mat-button mat-dialog-close [disabled]="running">{{'common.cancel' | transloco}}</button>
        <button mat-flat-button color="primary" [disabled]="!canRename()" (click)="rename()">{{'common.rename' | transloco}}</button>
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
    }, t('editState.conflict', {name: this.name}));
  }

  public async delete(): Promise<void> {
    await this.run(async () => {
      await this.storage.deleteState(this.data.game, this.data.state.name);
      this.dialogRef.close({action: 'deleted', name: this.data.state.name});
    }, t('editState.conflictDelete'));
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
