import {t} from '../../../i18n/i18n';
import {MatDialog, MatDialogRef} from '@angular/material/dialog';
import {DialogConfirmComponent, IDialogConfirmData} from '../../dialog-confirm/dialog-confirm.component';

/**
 * Asks before the master reveals the question or the answers on the screens by tapping them where they are shown
 * hidden: on the touch display, a tap there may be meant for something else, and the players can't unsee them.
 * `waitingNote` says when the part would appear by itself, e.g. "Sonst erscheint sie nach dem Video."
 * Closes with true if confirmed.
 */
export function openRevealConfirmation(dialog: MatDialog, part: 'question' | 'answers',
                                       waitingNote: string | null): MatDialogRef<DialogConfirmComponent, boolean> {
  const message = t(`play.reveal.${part}.message`);
  return dialog.open<DialogConfirmComponent, IDialogConfirmData, boolean>(DialogConfirmComponent, {
    data: {
      title: t(`play.reveal.${part}.title`),
      message: waitingNote ? `${message} ${waitingNote}` : message,
      confirmText: t('common.show')
    }
  });
}
