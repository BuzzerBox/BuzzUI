import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import {Observable} from 'rxjs';
import {GameService} from '../../services/game.service';
import {Injectable} from '@angular/core';
import {EGameStatesMaster} from '../enums/EGameStatesMaster';
import {pathsMaster} from '../paths-master';

/**
 * The pages the master may show in each state; the first one is where it goes when it opens any other page
 */
const pathsForState: Record<EGameStatesMaster, string[]> = {
  [EGameStatesMaster.STARTING]: [pathsMaster.start],
  [EGameStatesMaster.MASTER_ACCEPTED]: [pathsMaster.start],
  // like the setup, these are only there while no game is set up
  [EGameStatesMaster.RECEIVED_PRESETUP_DATA]: [pathsMaster.home, pathsMaster.setup, pathsMaster.loadGame, pathsMaster.prepare, pathsMaster.storage],
  [EGameStatesMaster.READY_TO_START]: [pathsMaster.readyToStart],
  [EGameStatesMaster.PLAYING]: [pathsMaster.play],
  // the play page shows the scores then
  [EGameStatesMaster.END]: [pathsMaster.play],
  [EGameStatesMaster.REJECTED]: [pathsMaster.masterAlreadyRegistered]
};

@Injectable()
export class RouteGuard  {
  constructor(private game: GameService, private router: Router) {
    game.useAsMaster();
  }

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    const path = route.url;
    const currentPath = path[path.length - 1].path;
    const allowedPaths = pathsForState[this.game.getGameState()] ?? [pathsMaster.start];
    // a page of another state leads to the one of the current state, which always lets the master in
    return allowedPaths.includes(currentPath) || this.redirect(allowedPaths[0]);
  }

  private redirect(target: string): UrlTree {
    return this.router.createUrlTree(['master/' + target]);
  }
}
