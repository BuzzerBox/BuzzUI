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
  const isQuestion = part === 'question';
  const message = isQuestion ? 'Die Frage erscheint dann auf der Anzeige.' : 'Die Antworten erscheinen dann auf der Anzeige.';
  return dialog.open<DialogConfirmComponent, IDialogConfirmData, boolean>(DialogConfirmComponent, {
    data: {
      title: isQuestion ? 'Frage zeigen?' : 'Antworten zeigen?',
      message: waitingNote ? `${message} ${waitingNote}` : message,
      confirmText: 'Zeigen'
    }
  });
}
