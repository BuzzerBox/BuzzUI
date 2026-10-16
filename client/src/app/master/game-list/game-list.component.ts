import {Component, Input, OnChanges, SimpleChanges} from '@angular/core';
import {Router} from '@angular/router';
import {MatDialog} from '@angular/material/dialog';
import {MatSnackBar} from '@angular/material/snack-bar';
import {IGameInfo, IGameStateInfo, IGameVersionInfo, IStorageLocation, StorageApiHelper} from '../../../../../shared/shared';
import {IGameRef, StorageService} from '../../services/storage.service';
import {FormatHelper} from '../../helper/format.helper';
import {GameFileHelper} from '../../helper/game-file.helper';
import {DialogConfirmComponent, IDialogConfirmData} from '../dialog-confirm/dialog-confirm.component';
import {IEditorNavigationState, IPrepareNavigationState} from '../game-navigation';
import {baseUrlMaster, pathsMaster} from '../paths-master';

/**
 * The games of a location, to start or continue one. With manage, games, their versions and states can also be
 * deleted and downloaded, and the media of a game managed.
 */
@Component({
    selector: 'app-game-list',
    templateUrl: './game-list.component.html',
    styleUrls: ['./game-list.component.css'],
    standalone: false
})
export class GameListComponent implements OnChanges {
  @Input() location: IStorageLocation;
  @Input() manage = false;

  public games: IGameInfo[] = null;
  public error: string = null;
  public busy = false;

  constructor(private storage: StorageService, private router: Router, private dialog: MatDialog, private snackBar: MatSnackBar) { }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.location) {
      this.reload();
    }
  }

  public async reload(): Promise<void> {
    if (this.location == null) {
      this.games = null;
      return;
    }
    const location = this.location;
    try {
      const games = await this.storage.listGames(location);
      // another location may have been chosen meanwhile
      if (location === this.location) {
        this.games = games;
        this.error = null;
      }
    } catch (e) {
      this.games = null;
      this.error = StorageService.getErrorMessage(e);
    }
  }

  public getRef(game: IGameInfo): IGameRef {
    return {location: this.location, gameName: game.name};
  }

  public getSummary(game: IGameInfo): string {
    if (game.latestVersion == null) {
      return 'Noch nicht gespeichert';
    }
    const latest = game.versions[0];
    const states = game.states.length === 1 ? '1 Spielstand' : `${game.states.length} Spielstände`;
    return `Version ${latest.version} · ${latest.questionCount} Fragen · ${states}`;
  }

  public getQuestionCount(game: IGameInfo, version: number): number {
    return game.versions.find(v => v.version === version)?.questionCount ?? 0;
  }

  public getStateDetails(game: IGameInfo, state: IGameStateInfo): string {
    const questionCount = this.getQuestionCount(game, state.gameVersion);
    const progress = state.finished ? 'beendet' : `Frage ${Math.min(state.currentQuestionNumber + 1, questionCount)} von ${questionCount}`;
    return `${progress} · zuletzt ${FormatHelper.formatDateTime(state.updatedAt)}`;
  }

  public getTeams(state: IGameStateInfo): string {
    return state.teams.map(team => `${team.name} (${team.points})`).join(', ');
  }

  public formatDate(isoDate: string): string {
    return FormatHelper.formatDateTime(isoDate);
  }

  public startNew(game: IGameInfo): void {
    this.prepare({locationId: this.location.id, gameName: game.name, gameVersion: game.latestVersion});
  }

  public continueState(game: IGameInfo, state: IGameStateInfo): void {
    this.prepare({locationId: this.location.id, gameName: game.name, gameVersion: state.gameVersion, stateName: state.name});
  }

  private prepare(state: IPrepareNavigationState): void {
    this.router.navigate([baseUrlMaster + pathsMaster.prepare], {state});
  }

  public edit(game: IGameInfo): void {
    const state: IEditorNavigationState = {locationId: this.location.id, gameName: game.name};
    this.router.navigate([baseUrlMaster + pathsMaster.setup], {state});
  }

  /**
   * Downloads the latest version, or the version of a state with the state, as one file
   */
  public async download(game: IGameInfo, state?: IGameStateInfo): Promise<void> {
    this.busy = true;
    try {
      const ref = this.getRef(game);
      const definition = await this.storage.getVersion(ref, state?.gameVersion ?? game.latestVersion);
      const stateContent = state != null ? await this.storage.getState(ref, state.name) : undefined;
      const fileName = (state != null ? `${game.name} - ${state.name}` : game.name) + StorageApiHelper.JSON_EXTENSION;
      GameFileHelper.download(fileName, GameFileHelper.makeBundle(game.name, definition, stateContent, state?.name));
    } catch (e) {
      this.snackBar.open(StorageService.getErrorMessage(e), 'OK', {duration: 6000});
    } finally {
      this.busy = false;
    }
  }

  public async deleteGame(game: IGameInfo): Promise<void> {
    if (await this.confirm('Spiel löschen',
      `Möchtest du „${game.name}“ mit allen Versionen, ${game.states.length} Spielständen und allen Medien löschen? Das lässt sich nicht rückgängig machen.`)) {
      await this.run(() => this.storage.deleteGame(this.getRef(game)), `„${game.name}“ wurde gelöscht.`);
    }
  }

  public async deleteState(game: IGameInfo, state: IGameStateInfo): Promise<void> {
    if (await this.confirm('Spielstand löschen', `Möchtest du den Spielstand „${state.name}“ löschen? Das lässt sich nicht rückgängig machen.`)) {
      await this.run(() => this.storage.deleteState(this.getRef(game), state.name), `„${state.name}“ wurde gelöscht.`);
    }
  }

  public canDeleteVersion(game: IGameInfo, version: IGameVersionInfo): boolean {
    return version.version !== game.latestVersion && version.stateCount === 0;
  }

  public async deleteVersion(game: IGameInfo, version: IGameVersionInfo): Promise<void> {
    if (await this.confirm('Version löschen', `Möchtest du Version ${version.version} von „${game.name}“ löschen?`)) {
      await this.run(() => this.storage.deleteVersion(this.getRef(game), version.version), `Version ${version.version} wurde gelöscht.`);
    }
  }

  private async run(action: () => Promise<void>, successMessage: string): Promise<void> {
    try {
      await action();
      this.snackBar.open(successMessage, 'OK', {duration: 4000});
    } catch (e) {
      const message = StorageService.isConflict(e) ? 'Das geht nicht, während es gespielt wird oder solange Spielstände es brauchen.' : StorageService.getErrorMessage(e);
      this.snackBar.open(message, 'OK', {duration: 6000});
    }
    await this.reload();
  }

  private confirm(title: string, message: string): Promise<boolean> {
    return this.dialog.open<DialogConfirmComponent, IDialogConfirmData, boolean>(DialogConfirmComponent, {
      data: {title, message, confirmText: 'Löschen'}
    }).afterClosed().toPromise().then(result => !!result);
  }
}
