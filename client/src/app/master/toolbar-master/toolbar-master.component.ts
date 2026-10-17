import {Component, Input, OnDestroy, OnInit} from '@angular/core';
import {Subscription} from 'rxjs';
import {GameService} from '../../services/game.service';
import {MatDialog} from '@angular/material/dialog';
import {IAutosaveInfoPacket} from '../../../../../shared/shared';
import {DialogTeamsComponent} from '../dialog-teams/dialog-teams.component';
import {DialogConfirmComponent, IDialogConfirmData} from '../dialog-confirm/dialog-confirm.component';
import {DialogConfirmEndingGameComponent} from '../../shared/play-ui/dialogs/dialog-confirm-ending-game/dialog-confirm-ending-game.component';
import {FormatHelper} from '../../helper/format.helper';
import {baseUrlMaster, pathsMaster} from '../paths-master';
import {EGameStatesMaster} from '../enums/EGameStatesMaster';

@Component({
    selector: 'app-toolbar-master',
    templateUrl: './toolbar-master.component.html',
    styleUrls: ['./toolbar-master.component.css'],
    standalone: false
})
export class ToolbarMasterComponent implements OnInit, OnDestroy {
  // the autosave status of the running game
  @Input() showSaveIcon = false;
  // on the play page: the teams, ending the game and resetting the server behind one "more" icon; the buzzers are
  // released in the middle of the page, see BuzzerLockComponent
  @Input() showGameMenu = false;
  // back to the start page, which is only there while no game is set up
  @Input() showHomeIcon = false;
  public readonly homeUrl = '/' + baseUrlMaster + pathsMaster.home;
  public autosave: IAutosaveInfoPacket = null;
  private subscription: Subscription;

  constructor(private game: GameService, private dialog: MatDialog) { }

  public openTeamsDialog(): void {
    this.dialog.open(DialogTeamsComponent);
  }

  ngOnInit(): void {
    this.subscription = this.game.observeAutosaveInfo().subscribe(info => this.autosave = info);
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  public getAutosaveText(): string {
    if (this.autosave?.storage == null) {
      return 'Dieses Spiel wird nicht gespeichert';
    }
    const where = `„${this.autosave.storage.stateName}“ auf ${this.autosave.locationName ?? 'der BuzzerBox'}`;
    if (this.autosave.error) {
      return `Speichern fehlgeschlagen (${this.autosave.error}), wird wiederholt: ${where}`;
    }
    return this.autosave.savedAt
      ? `Automatisch gespeichert um ${FormatHelper.formatDateTime(this.autosave.savedAt)}: ${where}`
      : `Wird automatisch gespeichert: ${where}`;
  }

  /**
   * The start page is only there while no game is set up, like the route guard says
   */
  public canGoHome(): boolean {
    return this.game.getGameState() === EGameStatesMaster.RECEIVED_PRESETUP_DATA;
  }

  public getName(): string {
    return this.game.getGameName();
  }

  public resetServer(): void {
    const message = this.showGameMenu
      ? 'Das laufende Spiel wird beendet, und alle Geräte starten von vorn.'
      : 'Alle Geräte starten von vorn.';
    this.dialog.open<DialogConfirmComponent, IDialogConfirmData, boolean>(DialogConfirmComponent, {
      data: {title: 'Server zurücksetzen?', message, confirmText: 'Zurücksetzen'}
    }).afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.game.resetServer();
      }
    });
  }

  public isGameOver(): boolean {
    return this.game.getGameState() === EGameStatesMaster.END;
  }

  public endGame(): void {
    DialogConfirmEndingGameComponent.confirmAndEndGame(this.dialog, this.game);
  }

}
