import {t, tn} from '../../i18n/i18n';
import {Component, EventEmitter, Input, OnChanges, Output, SimpleChanges} from '@angular/core';
import {Router} from '@angular/router';
import {MatDialog} from '@angular/material/dialog';
import {MatSnackBar} from '@angular/material/snack-bar';
import {IGameInfo, IGameStateInfo, IGameVersionInfo, IStorageLocation, StorageApiHelper} from '../../../../../shared/shared';
import {IGameRef, StorageService} from '../../services/storage.service';
import {FormatHelper} from '../../helper/format.helper';
import {GameFileHelper} from '../../helper/game-file.helper';
import {DialogConfirmComponent, IDialogConfirmData} from '../../shared/dialog-confirm/dialog-confirm.component';
import {DialogEditGameComponent, IDialogEditGameData, IDialogEditGameResult} from '../dialog-edit-game/dialog-edit-game.component';
import {DialogEditStateComponent, IDialogEditStateData, IDialogEditStateResult} from '../dialog-edit-state/dialog-edit-state.component';
import {IEditorNavigationState, IPrepareNavigationState} from '../game-navigation';
import {baseUrlMaster, pathsMaster} from '../paths-master';

export type TGameListMode = 'all' | 'new' | 'continue';

/**
 * The games of a location. In the modes new and continue, to start a game or continue one of its states. In the mode
 * all, with manage, to manage them: rename, move, copy or delete games, rename or delete states, delete versions,
 * download games (as an archive with everything, or just the questions), and manage the media of a game.
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
  /**
   * new and continue show just the games to start or all their states to continue, in one list each
   */
  @Input() mode: TGameListMode = 'all';
  /**
   * Emits when a game was moved or copied, which changes the free space of the locations
   */
  @Output() changed = new EventEmitter<void>();

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

  public getLocationText(): string {
    return StorageService.getLocationText(this.location);
  }

  /**
   * The games that were saved, which can be started
   */
  public getStartableGames(): IGameInfo[] {
    return this.games.filter(game => game.latestVersion !== null);
  }

  /**
   * The states of all games, the last played first
   */
  public getStates(): {game: IGameInfo, state: IGameStateInfo}[] {
    return this.games
      .flatMap(game => game.states.map(state => ({game, state})))
      .sort((a, b) => (b.state.updatedAt ?? '').localeCompare(a.state.updatedAt ?? ''));
  }

  public getRef(game: IGameInfo): IGameRef {
    return {location: this.location, gameName: game.name};
  }

  public getSummary(game: IGameInfo): string {
    if (game.latestVersion == null) {
      return t('games.summary.unsaved');
    }
    const latest = game.versions[0];
    return tn('games.summary', game.states.length, {version: latest.version, questions: tn('games.questionCount', latest.questionCount)});
  }

  public getVersionDetails(version: IGameVersionInfo): string {
    return tn('games.versionDetails', version.stateCount, {
      questions: tn('games.questionCount', version.questionCount),
      date: FormatHelper.formatDateTime(version.savedAt)
    });
  }

  public getQuestionCount(game: IGameInfo, version: number): number {
    return game.versions.find(v => v.version === version)?.questionCount ?? 0;
  }

  public getStateDetails(game: IGameInfo, state: IGameStateInfo): string {
    const questionCount = this.getQuestionCount(game, state.gameVersion);
    const date = FormatHelper.formatDateTime(state.updatedAt);
    return state.finished ? t('games.state.finished', {date})
      : t('games.state.progress', {current: Math.min(state.currentQuestionNumber + 1, questionCount), total: questionCount, date});
  }

  public formatDate(isoDate: string): string {
    return FormatHelper.formatDateTime(isoDate);
  }

  /**
   * Starts a new state, with the latest version unless another one is given
   */
  public startNew(game: IGameInfo, version = game.latestVersion): void {
    this.prepare({locationId: this.location.id, gameName: game.name, gameVersion: version});
  }

  public getVersion(game: IGameInfo, version: number): IGameVersionInfo | undefined {
    return game.versions.find(info => info.version === version);
  }

  public getLatest(game: IGameInfo): IGameVersionInfo | undefined {
    return this.getVersion(game, game.latestVersion);
  }

  /**
   * Whether media of the version are missing, so it can't be played as it is
   */
  public isBroken(version: IGameVersionInfo | undefined): boolean {
    return (version?.missingMediaCount ?? 0) > 0;
  }

  public getBrokenHint(version: IGameVersionInfo): string {
    return tn('games.broken', version.missingMediaCount, {version: version.version});
  }

  public continueState(game: IGameInfo, state: IGameStateInfo): void {
    this.prepare({locationId: this.location.id, gameName: game.name, gameVersion: state.gameVersion, stateName: state.name});
  }

  private prepare(state: IPrepareNavigationState): void {
    this.router.navigate([baseUrlMaster + pathsMaster.prepare], {state});
  }

  /**
   * Opens the editor with the questions of a version, which become a new version when saved; a game without versions
   * starts empty
   */
  public deriveVersion(game: IGameInfo, version?: IGameVersionInfo): void {
    const state: IEditorNavigationState = {locationId: this.location.id, gameName: game.name, baseVersion: version?.version};
    this.router.navigate([baseUrlMaster + pathsMaster.setup], {state});
  }

  /**
   * Downloads the whole game with its media as an archive. The browser does it itself, so large media don't have to
   * fit into its memory.
   */
  public async downloadArchive(game: IGameInfo): Promise<void> {
    try {
      const link = document.createElement('a');
      link.href = await this.storage.getGameArchiveUrl(this.getRef(game));
      link.download = game.name + StorageApiHelper.GAME_ARCHIVE_EXTENSION;
      link.click();
    } catch (e) {
      this.snackBar.open(t('games.downloadFailed', {error: StorageService.getErrorMessage(e)}), t('common.ok'), {duration: 6000});
    }
  }

  /**
   * Downloads the latest version as one file, without media and states. States only leave the box with their whole
   * game, in its archive.
   */
  public async download(game: IGameInfo): Promise<void> {
    this.busy = true;
    try {
      const definition = await this.storage.getVersion(this.getRef(game), game.latestVersion);
      GameFileHelper.download(game.name + StorageApiHelper.JSON_EXTENSION, GameFileHelper.makeBundle(game.name, definition));
    } catch (e) {
      this.snackBar.open(StorageService.getErrorMessage(e), t('common.ok'), {duration: 6000});
    } finally {
      this.busy = false;
    }
  }

  /**
   * Renames, moves, copies or deletes the game in one dialog
   */
  public async editGame(game: IGameInfo): Promise<void> {
    const result = await this.dialog.open<DialogEditGameComponent, IDialogEditGameData, IDialogEditGameResult>(DialogEditGameComponent, {
      data: {game, location: this.location},
      width: '560px'
    }).afterClosed().toPromise();
    if (!result) {
      return;
    }
    const where = StorageService.getLocationText(result.to);
    const messages = {
      renamed: t('games.result.renamed', {old: game.name, name: result.name}),
      moved: t('games.result.moved', {name: result.name, location: where}),
      copied: t('games.result.copied', {name: result.name, location: where}),
      deleted: t('games.result.deleted', {name: game.name})
    };
    if (result.originalKept) {
      this.snackBar.open(t('games.result.originalKept', {
        name: result.name, location: where, original: StorageService.getLocationText(this.location)
      }), t('common.ok'), {duration: 10000});
    } else {
      this.snackBar.open(messages[result.action], t('common.ok'), {duration: 4000});
    }
    this.changed.emit();
    await this.reload();
  }

  public async editState(game: IGameInfo, state: IGameStateInfo): Promise<void> {
    const result = await this.dialog.open<DialogEditStateComponent, IDialogEditStateData, IDialogEditStateResult>(DialogEditStateComponent, {
      data: {game: this.getRef(game), state},
      width: '480px'
    }).afterClosed().toPromise();
    if (result) {
      this.snackBar.open(t(result.action === 'renamed' ? 'games.result.stateRenamed' : 'games.result.deleted', {name: result.name}), t('common.ok'), {duration: 4000});
      await this.reload();
    }
  }

  /**
   * A version can only go once no state plays it anymore
   */
  public canDeleteVersion(version: IGameVersionInfo): boolean {
    return version.stateCount === 0;
  }

  public getDeleteVersionHint(version: IGameVersionInfo): string {
    if (this.canDeleteVersion(version)) {
      return t('games.deleteVersion.title');
    }
    return t('games.deleteVersion.blocked');
  }

  public async deleteVersion(game: IGameInfo, version: IGameVersionInfo): Promise<void> {
    let consequence = '';
    if (game.versions.length === 1) {
      consequence = ' ' + t('games.deleteVersion.noQuestionsLeft');
    } else if (version.version === game.latestVersion) {
      consequence = ' ' + t('games.deleteVersion.newLatest', {version: game.versions[1].version});
    }
    if (await this.confirm(t('games.deleteVersion.title'), t('games.deleteVersion.message', {version: version.version, game: game.name}) + consequence)) {
      await this.run(() => this.storage.deleteVersion(this.getRef(game), version.version), t('games.deleteVersion.deleted', {version: version.version}));
    }
  }

  private async run(action: () => Promise<void>, successMessage: string): Promise<void> {
    try {
      await action();
      this.snackBar.open(successMessage, t('common.ok'), {duration: 4000});
    } catch (e) {
      const message = StorageService.isConflict(e) ? t('games.conflict') : StorageService.getErrorMessage(e);
      this.snackBar.open(message, t('common.ok'), {duration: 6000});
    }
    await this.reload();
  }

  private confirm(title: string, message: string): Promise<boolean> {
    return this.dialog.open<DialogConfirmComponent, IDialogConfirmData, boolean>(DialogConfirmComponent, {
      data: {title, message, confirmText: t('common.delete')}
    }).afterClosed().toPromise().then(result => !!result);
  }
}
