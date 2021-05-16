import {ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot, UrlTree} from '@angular/router';
import {Observable} from 'rxjs';
import {GameService} from '../../services/game.service';
import {Injectable} from '@angular/core';
import {EGameStatesMaster} from '../enums/EGameStatesMaster';
import {pathsMaster} from '../paths-master';

@Injectable()
export class RouteGuard implements CanActivate {
  constructor(private game: GameService, private router: Router) {
  }

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    const path = route.url;
    const currentPath = path[path.length - 1].path;
    if (currentPath === pathsMaster.start) {
      return this.handleStartRoute();
    } else if (currentPath === pathsMaster.setup) {
      return this.handleSetupRoute();
    } else if (currentPath === pathsMaster.masterAlreadyRegistered) {
      return this.handleMasterAlreadyRegistered();
    }
    return false;
  }

  private handleStartRoute(): boolean | UrlTree {
    if (this.game.getGameState() === EGameStatesMaster.STARTING || this.game.getGameState() === EGameStatesMaster.MASTER_ACCEPTED) {
      return true;
    } else {
      return this.redirect(pathsMaster.masterAlreadyRegistered);
    }
  }

  private handleSetupRoute(): boolean | UrlTree {
    if (this.game.getGameState() === EGameStatesMaster.RECEIVED_PRESETUP_DATA) {
      return true;
    } else {
      return this.redirectToStart();
    }
  }

  private redirectToStart(): UrlTree {
    return this.redirect(pathsMaster.start);
  }

  private handleMasterAlreadyRegistered(): boolean | UrlTree {
    if (this.game.getGameState() === EGameStatesMaster.END) {
      return true;
    } else {
      return this.redirectToStart();
    }
  }

  private redirect(target: string): UrlTree {
    return this.router.createUrlTree([target]);
  }
}
