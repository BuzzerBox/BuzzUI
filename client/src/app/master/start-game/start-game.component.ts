import { Component, OnInit } from '@angular/core';
import {ClientGameMasterAndScreenService} from '../../services/game-client/client-game-master-and-screen.service';

@Component({
  selector: 'app-start-game',
  templateUrl: './start-game.component.html',
  styleUrls: ['./start-game.component.css']
})
export class StartGameComponent implements OnInit {

  constructor(private game: ClientGameMasterAndScreenService) {
    game.useAsMaster();
  }

  ngOnInit(): void {
  }

  public startGame(): void {
    this.game.startGame();
  }

  public getButtonText(): string {
    let s = 'Spiel ';
    if (this.game.didJoinRunningGame()) {
      s += 'Fortführen';
    } else {
      s += 'Beginnen';
    }
    return s + '!';

  }

}
