import {Component, Input, OnDestroy, OnInit} from '@angular/core';
import {Subscription} from 'rxjs';
import {GameService} from '../../services/game.service';
import {MatDialog} from '@angular/material/dialog';
import {MatSnackBar} from '@angular/material/snack-bar';
import {IAutosaveInfoPacket, StorageApiHelper} from '../../../../../shared/shared';
import {DialogTeamsComponent} from '../dialog-teams/dialog-teams.component';
import {StorageService} from '../../services/storage.service';
import {FormatHelper} from '../../helper/format.helper';
import {GameFileHelper} from '../../helper/game-file.helper';
import {baseUrlMaster, pathsMaster} from '../paths-master';

@Component({
    selector: 'app-toolbar-master',
    templateUrl: './toolbar-master.component.html',
    styleUrls: ['./toolbar-master.component.css'],
    standalone: false
})
export class ToolbarMasterComponent implements OnInit, OnDestroy {
  // the autosave status of the running game and downloading it
  @Input() showSaveIcon = false;
  @Input() showReleaseBuzzerLockIcon = false;
  // only once the game is set up, since the setup has its own teams step
  @Input() showTeamsIcon = false;
  // back to the start page, which is only there while no game is set up
  @Input() showHomeIcon = false;
  public readonly homeUrl = '/' + baseUrlMaster + pathsMaster.home;
  public autosave: IAutosaveInfoPacket = null;
  private subscription: Subscription;

  constructor(private game: GameService, private dialog: MatDialog, private storage: StorageService, private snackBar: MatSnackBar) { }

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

  public getName(): string {
    return this.game.getGameName();
  }

  /**
   * Downloads the game with its state as it was saved last, e.g. as a backup on this device
   */
  public async exportGameState(): Promise<void> {
    const ref = this.autosave?.storage;
    if (ref == null) {
      return;
    }
    try {
      const location = await this.storage.getLocation(ref.locationId);
      if (location == null) {
        throw new Error('Der Speicherort ist nicht mehr da.');
      }
      const gameRef = {location, gameName: ref.gameName};
      const definition = await this.storage.getVersion(gameRef, ref.gameVersion);
      const state = await this.storage.getState(gameRef, ref.stateName);
      GameFileHelper.download(`${ref.gameName} - ${ref.stateName}${StorageApiHelper.JSON_EXTENSION}`,
        GameFileHelper.makeBundle(ref.gameName, definition, state, ref.stateName));
    } catch (e) {
      this.snackBar.open('Der Spielstand konnte nicht heruntergeladen werden: ' + StorageService.getErrorMessage(e), 'OK', {duration: 6000});
    }
  }

  public resetServer(): void {
    this.game.resetServer();
    setTimeout(window.location.reload, 250);
    // ();
  }

  public releaseBuzzerLock(): void {
    this.game.releaseBuzzerLock();
  }

}
