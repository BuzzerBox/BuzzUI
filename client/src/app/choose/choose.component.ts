import { Component, OnInit } from '@angular/core';
import {ConfigService} from '../services/config.service';

@Component({
    selector: 'app-choose',
    templateUrl: './choose.component.html',
    styleUrls: ['./choose.component.css'],
    standalone: false
})
export class ChooseComponent implements OnInit {
  // the server ignores the dev board's buzzer presses unless browser keypresses are enabled
  public readonly isDevBoardAvailable = ConfigService.get().enableBrowserKeypressEvents;
  // what the guide tells the players to connect to, as on the screen's waiting page
  public readonly join = ConfigService.get().join;

  constructor() {
  }

  ngOnInit(): void {
  }

}
