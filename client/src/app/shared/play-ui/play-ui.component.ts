import {Component, HostBinding, Input, OnDestroy, OnInit} from '@angular/core';
import {GameService} from '../../services/game.service';
import {
  ITeam,
  IQuestion,
  IEndGamePacket,
  IMarkTeamPacket
} from '../../../../../shared/shared';
import {TeamColorHelper} from '../../helper/team-color.helper';
import {ScreenThemeHelper} from '../../themes/screen-theme.helper';
import {Subscription} from 'rxjs';
import {MatDialog} from '@angular/material/dialog';
import {DialogConfirmEndingGameComponent} from './dialogs/dialog-confirm-ending-game/dialog-confirm-ending-game.component';
import {SubscriptionsHelper} from '../../helper/subscriptions.helper';
import {ConfigService} from '../../services/config.service';
import {EGameStatesMaster} from '../../master/enums/EGameStatesMaster';

@Component({
    selector: 'app-play-ui',
    templateUrl: './play-ui.component.html',
    styleUrls: ['./play-ui.component.css'],
    standalone: false
})
export class PlayUiComponent implements OnInit, OnDestroy {
  @Input() isMaster = false;

  // the screens scale everything with their size, see the stylesheet
  @HostBinding('class.screen') get isScreen(): boolean {
    return !this.isMaster;
  }

  // the quiz-show themes, see screen-themes.ts
  @HostBinding('class.show') get isShowStyle(): boolean {
    return this.isScreen && ScreenThemeHelper.isShowStyle(this.game.getGameStateData()?.themeId);
  }

  /**
   * Rows of team cards on each side of the screens; at least 4, so a few teams don't get huge cards
   */
  @HostBinding('style.--team-rows') get teamRows(): number {
    return Math.max(4, Math.ceil((this.getTeams()?.length ?? 0) / 2));
  }

  public currentQuestion: IQuestion;
  // a screen learns it from the END_GAME packet
  private isScreenGameOver = false;
  private setQuestionPacketSubscription: Subscription;
  private markTeamSubscription: Subscription;
  // screens: the name of the team that just buzzed, across the question for a moment
  public buzzBanner: {id: number, name: string, color: string} | null = null;
  private buzzBannerTimeout: ReturnType<typeof setTimeout> | null = null;
  private static readonly BUZZ_BANNER_DURATION_IN_MS = 1500;
  // kept to remove the very same listener again
  private readonly keydownListener = (event: KeyboardEvent) => this.handleKeyboardEvent(event);

  constructor(private game: GameService, private dialog: MatDialog) { }

  ngOnInit(): void {
    this.currentQuestion = this.game.getCurrentQuestion();
    if (!this.isMaster) {
      // the theme of this game, for the whole page and the waiting screen after it
      ScreenThemeHelper.apply(this.game.getGameStateData()?.themeId);
      this.game.setCallbackUpdateCurrentQuestion(this.callbackUpdateCurrentQuestion.bind(this));
      this.game.setCallbackEndGame(this.callbackEndGame.bind(this));
      this.markTeamSubscription = this.game.observeMarkTeamPackets().subscribe(this.onMarkTeamPacket.bind(this));
      // There is some angular directive to achieve the binding of a listener (@HostListener) but it is not possible to remove that binding
      // or have it react to some boolean state but we only need it if this component is used from a screen, thus I prefer the "old" JS-way
      // of adding an event listener
      // keys only work as buzzers where the config allows it, see enableBrowserKeypressEvents
      if (ConfigService.get().enableBrowserKeypressEvents) {
        document.addEventListener('keydown', this.keydownListener);
      }
    }
  }

  /**
   * The master ends the game in its toolbar, and comes back to the scores when it opens the play page again afterwards
   */
  public get isGameOver(): boolean {
    return this.isMaster ? this.game.getGameState() === EGameStatesMaster.END : this.isScreenGameOver;
  }

  public getTextColor(color: string): string {
    return TeamColorHelper.getTextColor(color);
  }

  public getTeams(): ITeam[] {
    return this.game.getTeams();
  }

  public getQuestions(): IQuestion[] {
    return this.game.getQuestions();
  }

  public getCurrentQuestion(): IQuestion {
    return this.game.getCurrentQuestion();
  }

  public getPreviousQuestion(): void {
    this.currentQuestion = this.game.getPreviousQuestion();
  }

  public getNextQuestion(): void {
    this.currentQuestion = this.game.getNextQuestion();
  }

  public hasPreviousQuestion(): boolean {
    return this.game.hasPreviousQuestion();
  }

  public hasNextQuestion(): boolean {
    return this.game.hasNextQuestion();
  }

  public endGame(): void {
    DialogConfirmEndingGameComponent.confirmAndEndGame(this.dialog, this.game);
  }

  // TODO implement this as observable instead of this callback fizzle
  private callbackUpdateCurrentQuestion(): void {
    this.currentQuestion = this.game.getCurrentQuestion();
  }

  ngOnDestroy(): void {
    SubscriptionsHelper.cleanUpSubscriptions(this.setQuestionPacketSubscription, this.markTeamSubscription);
    clearTimeout(this.buzzBannerTimeout);
    if (!this.isMaster) {
      document.removeEventListener('keydown', this.keydownListener);
    }
  }

  private onMarkTeamPacket(packet: IMarkTeamPacket): void {
    const team = this.isShowStyle && packet.mark && !packet.unmarkAll ? this.game.findTeam(packet.teamId) : null;
    if (team == null) {
      return;
    }
    this.buzzBanner = {id: (this.buzzBanner?.id ?? 0) + 1, name: team.name, color: TeamColorHelper.getColor(team, this.getTeams())};
    clearTimeout(this.buzzBannerTimeout);
    this.buzzBannerTimeout = setTimeout(() => this.buzzBanner = null, PlayUiComponent.BUZZ_BANNER_DURATION_IN_MS);
  }

  private callbackEndGame(packet: IEndGamePacket): void {
    this.isScreenGameOver = true;
  }

  handleKeyboardEvent(event: KeyboardEvent): void {
    console.log(event.code);
    this.game.sendKeypress(event.code);
  }





}
