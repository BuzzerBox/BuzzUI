import { Component, OnInit } from '@angular/core';
import {GameService} from '../../services/game.service';
import {Observable, Subscription} from 'rxjs';

@Component({
  selector: 'app-connect',
  templateUrl: './connect.component.html',
  styleUrls: ['./connect.component.css']
})
export class ConnectComponent implements OnInit {
  public isWebsocketConnected = false;
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
