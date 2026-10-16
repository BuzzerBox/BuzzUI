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

  constructor() {
  }

  ngOnInit(): void {
  }

}
