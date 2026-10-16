import {Component, OnInit} from '@angular/core';
import {BehaviorSubject} from 'rxjs';
import {GameService} from '../services/game.service';
import {WebSocketService} from '../services/web-socket.service';
import {ConfigService} from '../services/config.service';

/**
 * Simulates the buzzer board in the browser: every button sends the keypress that is bound to it in the config.
 * The server only accepts these while enableBrowserKeypressEvents is set.
 */
@Component({
  selector: 'app-virtual-dev-board',
  templateUrl: './virtual-dev-board.component.html',
  styleUrls: ['./virtual-dev-board.component.css'],
  standalone: false
})
export class VirtualDevBoardComponent implements OnInit {
  public readonly buzzers = ConfigService.get().buzzers;

  public isConnected$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);

  constructor(
    private game: GameService,
    private webSocketService: WebSocketService
  ) { }

  ngOnInit(): void {
    // resolves once the server is reachable
    this.webSocketService.listen(() => undefined).then(subscription => {
      subscription.unsubscribe();
      this.isConnected$.next(true);
    });
  }

  /**
   * The number is 0-based, meaning that the first buzzer is 0
   */
  sendBuzzerPress(buzzerNo: number): void {
    this.game.sendKeypress(this.buzzers[buzzerNo].key);
  }

  sendReleaseLockButtonPress(): void {
    this.game.sendKeypress(ConfigService.get().softReleaseKey);
  }

}
