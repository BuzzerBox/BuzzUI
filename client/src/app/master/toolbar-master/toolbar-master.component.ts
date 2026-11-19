import {Component, Input, OnDestroy, OnInit} from '@angular/core';
import {Subscription} from 'rxjs';
import {GameService} from '../../services/game.service';
import {MatDialog} from '@angular/material/dialog';
import {IAutosaveInfoPacket, TLanguage} from '../../../../../shared/shared';
import {LANGUAGE_NAMES, t} from '../../i18n/i18n';
import {LanguageService} from '../../i18n/language.service';
import {DialogTeamsComponent} from '../dialog-teams/dialog-teams.component';
import {DialogConfirmComponent, IDialogConfirmData} from '../../shared/dialog-confirm/dialog-confirm.component';
import {DialogConfirmEndingGameComponent} from '../../shared/play-ui/dialogs/dialog-confirm-ending-game/dialog-confirm-ending-game.component';
import {FormatHelper} from '../../helper/format.helper';
import {baseUrlMaster, pathsMaster} from '../paths-master';
import {EGameStatesMaster} from '../enums/EGameStatesMaster';
import {KioskHelper} from '../../helper/kiosk.helper';

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
  // on the play page: the current question's number and points, see QuestionPaneComponent
  @Input() showQuestionProgress = false;
  // the box's settings (buzzerbox.txt), only on the start page as well
  @Input() showSettings = false;
  public readonly homeUrl = '/' + baseUrlMaster + pathsMaster.home;
  public readonly settingsUrl = '/' + baseUrlMaster + pathsMaster.settings;
  // the box's touch display stays the master
  public readonly canLogout = !KioskHelper.isActive();
  public autosave: IAutosaveInfoPacket = null;
  public readonly languageNames = LANGUAGE_NAMES;
  private subscription: Subscription;

  constructor(private game: GameService, private dialog: MatDialog, private language: LanguageService) { }

  public otherLanguages(): TLanguage[] {
    return this.language.languages.filter(language => language !== this.language.getLanguage());
  }

  public setLanguage(language: TLanguage): void {
    this.game.setLanguage(language);
  }

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
      return t('toolbar.autosave.none');
    }
    // the server names the box "BuzzerBox" and a USB stick by its name
    const location = this.autosave.locationName == null || this.autosave.locationName === 'BuzzerBox'
      ? t('location.text.box') : t('location.text.usb', {name: this.autosave.locationName});
    const where = t('toolbar.autosave.where', {state: this.autosave.storage.stateName, location});
    if (this.autosave.error) {
      return t('toolbar.autosave.failed', {error: this.autosave.error, where});
    }
    return this.autosave.savedAt
      ? t('toolbar.autosave.savedAt', {time: FormatHelper.formatDateTime(this.autosave.savedAt), where})
      : t('toolbar.autosave.saving', {where});
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
    this.confirm(t('toolbar.confirmReset.title'), t('toolbar.confirmReset.message'), t('toolbar.confirmReset.confirm'), () => this.game.resetServer());
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

  /**
   * While a question is shown, i.e. not before the first one (the welcome) and not after the game
   */
  public hasQuestionProgress(): boolean {
    return !this.isGameOver() && !this.game.isWelcome() && !!this.game.getCurrentQuestion();
  }

  public getCurrentQuestionNumber(): number {
    return this.game.getCurrentQuestionNumber() + 1;
  }

  public getTotalQuestionNumber(): number {
    return this.game.getQuestions().length;
  }

  public getPointsLabel(): string | null {
    return this.game.getQuestionPointsLabel(this.game.getCurrentQuestion());
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
      ? t('toolbar.confirmPause.saved', {state: stateName})
      : t('toolbar.confirmPause.unsaved');
    this.confirm(t('toolbar.confirmPause.title'), message, t('toolbar.confirmPause.confirm'), () => this.game.resetServer());
  }

  /**
   * Back to the start page without the end screen, deleting the state, so it is no longer offered to be continued
   */
  public discardGame(): void {
    const stateName = this.autosave?.storage?.stateName;
    const message = stateName
      ? t('toolbar.confirmDiscard.saved', {state: stateName})
      : t('toolbar.confirmDiscard.unsaved');
    this.confirm(t('toolbar.confirmDiscard.title'), message, t('toolbar.confirmDiscard.confirm'), () => this.game.resetServer(true));
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
