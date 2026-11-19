import {Component} from '@angular/core';
import {MatDialog} from '@angular/material/dialog';
import {GameService, IMasterRejection} from '../../services/game.service';
import {DialogConfirmComponent, IDialogConfirmData} from '../../shared/dialog-confirm/dialog-confirm.component';
import {baseUrlScreen} from '../../screen/paths-screen';
import {KioskHelper} from '../../helper/kiosk.helper';
import {t} from '../../i18n/i18n';

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
  // the box's touch display stays the master, it can only take the control back
  public readonly canUseAsScreen = !KioskHelper.isActive();

  constructor(private game: GameService, private dialog: MatDialog) { }

  public getRejection(): IMasterRejection {
    return this.game.getMasterRejection() ?? {isGameRunning: false, takenOver: false};
  }

  public retry(): void {
    this.game.registerAgainAsMaster();
  }

  public takeOver(): void {
    const message = this.getRejection().isGameRunning
      ? t('otherMaster.confirm.gameRunning')
      : t('otherMaster.confirm.noGame');
    this.game.pauseMasterRetry(true);
    this.dialog.open<DialogConfirmComponent, IDialogConfirmData, boolean>(DialogConfirmComponent, {
      data: {title: t('otherMaster.confirm.title'), message, confirmText: t('otherMaster.confirm.confirm')}
    }).afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.game.registerAgainAsMaster(true);
      }
      this.game.pauseMasterRetry(false);
    });
  }

  public useAsScreen(): void {
    // this page set the app up as master, so the screen needs a fresh start
    window.location.assign('/' + baseUrlScreen);
  }
}
