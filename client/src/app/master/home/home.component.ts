import {Component, OnDestroy, OnInit} from '@angular/core';
import {Subscription} from 'rxjs';
import versionInfo from '../../../../../version.json';
import {Title} from '@angular/platform-browser';
import {GameService} from '../../services/game.service';
import {StorageService} from '../../services/storage.service';
import {ConfigService} from '../../services/config.service';
import {baseUrlMaster, pathsMaster} from '../paths-master';

/**
 * Where the master starts: start a saved game anew, continue one of its states, or manage the games (where they are
 * also created)
 */
@Component({
    selector: 'app-home',
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.css'],
    standalone: false
})
export class HomeComponent implements OnInit, OnDestroy {
  public readonly loadGameUrl = '/' + baseUrlMaster + pathsMaster.loadGame;
  public readonly storageUrl = '/' + baseUrlMaster + pathsMaster.storage;

  // like the locations, sticks can be plugged in or pulled out any time
  private static readonly REFRESH_INTERVAL_IN_MS = 5000;

  // the version the server reports as installed, or this page's until it does
  private installedVersion: string = versionInfo.version;
  private subscription: Subscription;
  // whether there are games to start and states to continue on any location; null until known, when the buttons stay
  // usable
  public hasGames: boolean | null = null;
  public hasStates: boolean | null = null;
  private interval: ReturnType<typeof setInterval>;

  constructor(private game: GameService, private storage: StorageService, titleService: Title) {
    titleService.setTitle(ConfigService.get().gameName + ' ' + ConfigService.get().masterName);
    game.useAsMaster();
    this.subscription = game.observeUpdateInfo().subscribe(info => this.installedVersion = info.installedVersion);
  }

  ngOnInit(): void {
    this.refreshGames();
    this.interval = setInterval(() => this.refreshGames(), HomeComponent.REFRESH_INTERVAL_IN_MS);
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
    clearInterval(this.interval);
  }

  private async refreshGames(): Promise<void> {
    if (!this.storage.isAvailable()) {
      return;
    }
    try {
      const games = (await Promise.all((await this.storage.getLocations()).map(location => this.storage.listGames(location)))).flat();
      this.hasGames = games.some(game => game.latestVersion !== null);
      this.hasStates = games.some(game => game.states.length > 0);
    } catch (e) {
      // e.g. a stick pulled out while it was read; the next refresh tells
    }
  }

  public getVersion(): string {
    return this.installedVersion;
  }

  public getGameName(): string {
    return this.game.getGameName();
  }
}
