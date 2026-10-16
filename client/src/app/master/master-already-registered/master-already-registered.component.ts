import {Component} from '@angular/core';
import {MatDialog} from '@angular/material/dialog';
import {GameService, IMasterRejection} from '../../services/game.service';
import {DialogConfirmComponent, IDialogConfirmData} from '../dialog-confirm/dialog-confirm.component';
import {baseUrlScreen} from '../../screen/paths-screen';

/**
 * Shown when another device is the master: explains why, keeps trying to get in and lets this device take over
 */
@Component({
    selector: 'app-master-already-registered',
    templateUrl: './master-already-registered.component.html',
    styleUrls: ['./master-already-registered.component.css'],
    standalone: false
})
export class MasterAlreadyRegisteredComponent {

  constructor(private game: GameService, private dialog: MatDialog) { }

  public getRejection(): IMasterRejection {
    return this.game.getMasterRejection() ?? {isGameRunning: false, takenOver: false};
  }

  public retry(): void {
    this.game.registerAgainAsMaster();
  }

  public takeOver(): void {
    const message = this.getRejection().isGameRunning
      ? 'Das andere Gerät kann das Spiel dann nicht mehr steuern. Das laufende Spiel geht hier mit dem aktuellen Punktestand weiter.'
      : 'Das andere Gerät kann die BuzzerBox dann nicht mehr steuern. Was dort gerade eingegeben, aber noch nicht gespeichert wurde, geht verloren.';
    this.dialog.open<DialogConfirmComponent, IDialogConfirmData, boolean>(DialogConfirmComponent, {
      data: {title: 'Steuerung übernehmen?', message, confirmText: 'Übernehmen'}
    }).afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.game.registerAgainAsMaster(true);
      }
    });
  }

  public useAsScreen(): void {
    // this page set the app up as master, so the screen needs a fresh start
    window.location.assign('/' + baseUrlScreen);
  }
}
