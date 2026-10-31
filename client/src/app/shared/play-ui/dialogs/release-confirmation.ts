import {MatDialog, MatDialogRef} from '@angular/material/dialog';
import {DialogConfirmComponent, IDialogConfirmData} from '../../dialog-confirm/dialog-confirm.component';

/**
 * Asks before the buzzers are released without a grade, from the buzzer lock button or the grade dialog: a tap by
 * mistake would throw the answer of the team that buzzed away. Closes with true if confirmed.
 */
export function openReleaseConfirmation(dialog: MatDialog, teamName: string | null): MatDialogRef<DialogConfirmComponent, boolean> {
  return dialog.open<DialogConfirmComponent, IDialogConfirmData, boolean>(DialogConfirmComponent, {
    data: {
      title: 'Buzzer freigeben?',
      message: teamName
        ? `Die Antwort von ${teamName} wird nicht bewertet, und alle Teams können wieder buzzern.`
        : 'Alle Teams können wieder buzzern.',
      confirmText: 'Freigeben'
    }
  });
}
