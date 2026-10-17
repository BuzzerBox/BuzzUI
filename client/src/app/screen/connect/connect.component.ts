import { Component, OnInit } from '@angular/core';
import {GameService} from '../../services/game.service';
import {Subscription} from 'rxjs';
import {ConfigService} from '../../services/config.service';
import {ScreenThemeHelper} from '../../themes/screen-theme.helper';

@Component({
    selector: 'app-connect',
    templateUrl: './connect.component.html',
    styleUrls: ['./connect.component.css'],
    standalone: false
})
export class ConnectComponent implements OnInit {
  public isWebsocketConnected = false;
  // the theme of the screen's last game, until the next one is set up
  private readonly theme = ScreenThemeHelper.getStored();
  public readonly isShowStyle = this.theme.style === 'show';
  // the classic theme's spinner: as large as before on big screens, but no more than half of a small one
  public readonly spinnerDiameter = Math.round(Math.min(400, window.innerHeight * 0.5, window.innerWidth * 0.5));
  // how to get to the master, shown to the person hosting while the screen waits
  public readonly join = ConfigService.get().join;
  private isWebsocketConnectedSubscription: Subscription;

  constructor(private game: GameService) {
    game.useAsScreen();
    ScreenThemeHelper.apply(this.theme.id);
    this.isWebsocketConnectedSubscription = this.game.observeIsWebsocketConnected().subscribe(isConnected => {
      if (isConnected) {
        this.isWebsocketConnected = true;
      }
    });
  }

  ngOnInit(): void {
  }

}
