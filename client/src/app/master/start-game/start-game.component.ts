import { Component, OnInit } from '@angular/core';
import {GameService} from '../../services/game.service';

@Component({
  selector: 'app-start-game',
  templateUrl: './start-game.component.html',
  styleUrls: ['./start-game.component.css']
})
export class StartGameComponent implements OnInit {

  constructor(private game: GameService) {
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
