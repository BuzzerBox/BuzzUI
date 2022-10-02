import { Component, OnInit } from '@angular/core';
import {ClientGameMasterAndScreenService} from '../../services/game-client/client-game-master-and-screen.service';
import {Subscription} from 'rxjs';

@Component({
  selector: 'app-connect',
  templateUrl: './connect.component.html',
  styleUrls: ['./connect.component.css']
})
export class ConnectComponent implements OnInit {
  public isWebsocketConnected = false;
  private isWebsocketConnectedSubscription: Subscription;

  constructor(private game: ClientGameMasterAndScreenService) {
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
