import { Component, OnInit } from '@angular/core';
import {BehaviorSubject} from 'rxjs';
import {ClientGameVirtualDevBoardService} from '../services/game-client/client-game-virtual-dev-board.service';
import config from '../../../../config.json';

@Component({
  selector: 'app-virtual-dev-board',
  templateUrl: './virtual-dev-board.component.html',
  styleUrls: ['./virtual-dev-board.component.css']
})
export class VirtualDevBoardComponent implements OnInit {
  public readonly NUMBER_OF_BUZZERS = config.buzzers.length;

  public isConnected$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);

  constructor(
    private game: ClientGameVirtualDevBoardService
  ) { }

  ngOnInit(): void {
    // simulating a deferred connection
    setTimeout(() => {
      this.isConnected$.next(true);
    }, 1000);
  }

  /**
   * The number is 0-based, meaning that the first buzzer 0
   **/
  sendBuzzerPress(buzzerNo: number): void {
    this.game.sendKeypress(config.buzzers[buzzerNo].key);
  }

  sendReleaseLockButtonPress(): void {
    this.game.sendKeypress(config.softReleaseKey);
  }

}
