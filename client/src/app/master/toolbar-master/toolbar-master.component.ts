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
  // on the play page: the teams and ending, pausing or discarding the game behind one "more" icon; the buzzers are
  // released in the middle of the page, see BuzzerLockComponent
  @Input() showGameMenu = false;
  // back to the start page, which is only there while no game is set up
  @Input() showHomeIcon = false;
  // only on the start page, where no game is set up
  @Input() showResetServer = false;
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
    this.confirm('Server zurücksetzen?', 'Alle Geräte starten von vorn.', 'Zurücksetzen', () => this.game.resetServer());
  }

  /**
   * Back to choosing what this device is for, which gives up being the master; offered on every page but the running
   * game's
   */
  public logout(): void {
    // the page set the app up as master; loading it anew closes the connection, so the server lets another master in
    window.location.assign('/choose');
  }

  public isGameOver(): boolean {
    return this.game.getGameState() === EGameStatesMaster.END;
  }

  public endGame(): void {
    DialogConfirmEndingGameComponent.confirmAndEndGame(this.dialog, this.game);
  }

  /**
   * Back to the start page without the end screen; the state stays saved, so the game can be continued
   */
  public pauseGame(): void {
    const stateName = this.autosave?.storage?.stateName;
    const message = stateName
      ? `Der Spielstand „${stateName}“ bleibt gespeichert. Unter „Spiel fortsetzen“ geht es später an derselben Stelle weiter.`
      : 'Dieses Spiel wird nicht gespeichert und kann daher nicht fortgesetzt werden.';
    this.confirm('Spiel pausieren?', message, 'Pausieren', () => this.game.resetServer());
  }

  /**
   * Back to the start page without the end screen, deleting the state, so it is no longer offered to be continued
   */
  public discardGame(): void {
    const stateName = this.autosave?.storage?.stateName;
    const message = stateName
      ? `Der Spielstand „${stateName}“ wird gelöscht, auch wenn er schon früher gespielt wurde, und lässt sich nicht fortsetzen.`
      : 'Das Spiel wird ohne Endstand beendet.';
    this.confirm('Spiel verwerfen?', message, 'Verwerfen', () => this.game.resetServer(true));
  }

  private confirm(title: string, message: string, confirmText: string, onConfirmed: () => void): void {
    this.dialog.open<DialogConfirmComponent, IDialogConfirmData, boolean>(DialogConfirmComponent, {
      data: {title, message, confirmText}
    }).afterClosed().subscribe(confirmed => {
      if (confirmed) {
        onConfirmed();
      }
    });
  }

}
