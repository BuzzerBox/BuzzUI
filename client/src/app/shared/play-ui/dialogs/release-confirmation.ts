import {t} from '../../../i18n/i18n';
import {MatDialog, MatDialogRef} from '@angular/material/dialog';
import {DialogConfirmComponent, IDialogConfirmData} from '../../dialog-confirm/dialog-confirm.component';

/**
 * Asks before the buzzers are released without a grade, from the buzzer lock button or the grade dialog: a tap by
 * mistake would throw the answer of the team that buzzed away. Closes with true if confirmed.
 */
export function openReleaseConfirmation(dialog: MatDialog, teamName: string | null): MatDialogRef<DialogConfirmComponent, boolean> {
  return dialog.open<DialogConfirmComponent, IDialogConfirmData, boolean>(DialogConfirmComponent, {
    data: {
      title: t('play.lock.confirm.title'),
      message: teamName
        ? t('play.lock.confirm.withTeam', {team: teamName})
        : t('play.lock.confirm.withoutTeam'),
      confirmText: t('play.lock.confirm.confirm')
    }
  });
}
