import { Component, OnInit } from '@angular/core';
import {GameService} from '../../services/game.service';
import {Observable, Subscription} from 'rxjs';

@Component({
    selector: 'app-connect',
    templateUrl: './connect.component.html',
    styleUrls: ['./connect.component.css'],
    standalone: false
})
export class ConnectComponent implements OnInit {
  public isWebsocketConnected = false;
  // as large as before on big screens, but no more than half of a small one
  public readonly spinnerDiameter = Math.round(Math.min(400, window.innerHeight * 0.5, window.innerWidth * 0.5));
  private isWebsocketConnectedSubscription: Subscription;

  constructor(private game: GameService) {
    game.useAsScreen();
    this.isWebsocketConnectedSubscription = this.game.observeIsWebsocketConnected().subscribe(isConnected => {
      if (isConnected) {
        this.isWebsocketConnected = true;
      }
    });
  }

  ngOnInit(): void {
  }

}
