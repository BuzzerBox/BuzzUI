import {Component, Inject} from '@angular/core';
import {MAT_DIALOG_DATA} from '@angular/material/dialog';

export interface IDialogConfirmData {
  title: string;
  message: string;
  confirmText: string;
}

/**
 * Asks before something that can't be undone, like deleting. Closes with true if confirmed.
 */
@Component({
    selector: 'app-dialog-confirm',
    template: `
      <h1 mat-dialog-title>{{data.title}}</h1>
      <div mat-dialog-content><p>{{data.message}}</p></div>
      <div mat-dialog-actions align="end">
        <button mat-button [mat-dialog-close]="false" cdkFocusInitial>Abbrechen</button>
        <button mat-flat-button color="warn" [mat-dialog-close]="true">{{data.confirmText}}</button>
      </div>
    `,
    standalone: false
})
export class DialogConfirmComponent {
  constructor(@Inject(MAT_DIALOG_DATA) public data: IDialogConfirmData) { }
}
