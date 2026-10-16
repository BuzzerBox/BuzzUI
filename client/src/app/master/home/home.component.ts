import {Component} from '@angular/core';
import {Title} from '@angular/platform-browser';
import {GameService} from '../../services/game.service';
import {ConfigService} from '../../services/config.service';
import {baseUrlMaster, pathsMaster} from '../paths-master';

/**
 * Where the master starts: create a game, run a prepared one, or manage the media and save games
 */
@Component({
    selector: 'app-home',
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.css'],
    standalone: false
})
export class HomeComponent {
  public readonly setupUrl = '/' + baseUrlMaster + pathsMaster.setup;
  public readonly loadGameUrl = '/' + baseUrlMaster + pathsMaster.loadGame;
  public readonly storageUrl = '/' + baseUrlMaster + pathsMaster.storage;

  constructor(private game: GameService, titleService: Title) {
    titleService.setTitle(ConfigService.get().gameName + ' ' + ConfigService.get().masterName);
    game.useAsMaster();
  }

  public getGameName(): string {
    return this.game.getGameName();
  }
}
