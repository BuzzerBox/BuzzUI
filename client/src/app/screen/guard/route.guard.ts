import {Injectable} from '@angular/core';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import {GameService} from '../../services/game.service';
import {Observable} from 'rxjs';
import {pathsScreen} from '../paths-screen';
import {pathsMaster} from '../../master/paths-master';

@Injectable()
export class RouteGuard  {
  constructor(private game: GameService, private router: Router) {
    game.useAsScreen();
  }

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    const path = route.url;
    const currentPath = path[path.length - 1].path;
    switch (currentPath) {
      case pathsScreen.main:
        // the screen shows the game from now on, also when it loads again
        this.game.useAsGameScreen();
        return this.handleGameRoute();
      case pathsScreen.team:
        // the points of a team from now on, see TeamComponent
        if (!this.game.isTeamScreen()) {
          this.game.useAsTeamScreen(null);
        }
        return this.handleGameRoute();
      case pathsScreen.connect:
        return this.handleConnectRoute();
      default:
        return false;
    }
  }

  private handleConnectRoute(): boolean | UrlTree {
    if (!this.game.dataAvailable()) {
      return true;
    } else {
      return this.router.createUrlTree([this.game.getScreenStartPath()]);
    }
  }

  /**
   * The pages of the game need it, so they wait for it on the connect page; the game takes the screen back to them
   */
  private handleGameRoute(): boolean | UrlTree {
    if (this.game.dataAvailable()) {
      return true;
    } else {
      return this.redirectToConnect();
    }
  }

  private redirectToConnect(): UrlTree {
    return this.redirect(pathsScreen.connect);
  }

  private redirect(target: string): UrlTree {
    return this.router.createUrlTree(['screen/' + target]);
  }
}
