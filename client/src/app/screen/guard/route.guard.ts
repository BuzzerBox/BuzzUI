import {Injectable} from '@angular/core';
import {ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot, UrlTree} from '@angular/router';
import {GameService} from '../../services/game.service';
import {Observable} from 'rxjs';
import {pathsScreen} from '../paths-screen';
import {pathsMaster} from '../../master/paths-master';

@Injectable()
export class RouteGuard implements CanActivate {
  constructor(private game: GameService, private router: Router) {
    game.useAsScreen();
  }

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    const path = route.url;
    const currentPath = path[path.length - 1].path;
    switch (currentPath) {
      case pathsScreen.main:
        return this.handleMainRoute();
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
      return this.redirect(pathsScreen.main);
    }
  }

  private handleMainRoute(): boolean | UrlTree {
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
