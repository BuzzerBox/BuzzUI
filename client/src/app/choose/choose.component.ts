import {Component, OnDestroy, OnInit} from '@angular/core';
import {Subscription} from 'rxjs';
import {ConfigService} from '../services/config.service';
import {GameService} from '../services/game.service';

@Component({
    selector: 'app-choose',
    templateUrl: './choose.component.html',
    styleUrls: ['./choose.component.css'],
    standalone: false
})
export class ChooseComponent implements OnInit, OnDestroy {
  // how often the page asks whether a game runs, and how long it waits for an answer before it asks again
  private static readonly GAME_INFO_INTERVAL_IN_MS = 5000;
  private static readonly GAME_INFO_TIMEOUT_IN_MS = 15000;

  // the server ignores the dev board's buzzer presses unless browser keypresses are enabled
  public readonly isDevBoardAvailable = ConfigService.get().enableBrowserKeypressEvents;
  // what the guide tells the players to connect to, as on the screen's waiting page
  public readonly join = ConfigService.get().join;
  // the points screen of a team needs a game, see TeamComponent
  public isGameRunning = false;
  private gameInfoSubscription: Subscription;
  private gameInfoTimer: ReturnType<typeof setInterval> | null = null;
  private lastGameInfoRequest = 0;
  private isAwaitingGameInfo = false;

  constructor(private game: GameService) {
  }

  ngOnInit(): void {
    this.gameInfoSubscription = this.game.observeGameInfo().subscribe(info => {
      this.isGameRunning = info.isGameRunning;
      this.isAwaitingGameInfo = false;
    });
    this.requestGameInfo();
    // a game can start or end while the page is open
    this.gameInfoTimer = setInterval(() => this.requestGameInfo(), ChooseComponent.GAME_INFO_INTERVAL_IN_MS);
  }

  /**
   * Asks again only once the last request is answered, or got lost with the connection; while there is none, the
   * request waits for the next one
   */
  private requestGameInfo(): void {
    if (this.isAwaitingGameInfo && Date.now() - this.lastGameInfoRequest < ChooseComponent.GAME_INFO_TIMEOUT_IN_MS) {
      return;
    }
    this.isAwaitingGameInfo = true;
    this.lastGameInfoRequest = Date.now();
    this.game.requestGameInfo();
  }

  ngOnDestroy(): void {
    this.gameInfoSubscription?.unsubscribe();
    clearInterval(this.gameInfoTimer);
  }

}
