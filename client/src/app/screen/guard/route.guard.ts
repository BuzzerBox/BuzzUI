import {inject, Injectable} from '@angular/core';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import {GameService} from '../../services/game.service';
import {Observable} from 'rxjs';
import {pathsScreen} from '../paths-screen';
import {CLIENT_EXTENSION_LIST, ExtensionModeHelper} from '../../extensions/extension-modes';
import {pathsMaster} from '../../master/paths-master';

@Injectable()
export class RouteGuard  {
  private readonly extensions = inject(CLIENT_EXTENSION_LIST);
  constructor(private game: GameService, private router: Router) {
    game.useAsScreen();
  }

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    // as the route config has it, so that an extension's paths may have several segments
    const currentPath = route.routeConfig?.path ?? route.url.map(segment => segment.path).join('/');
    // while an extension's mode is on, the screens only show its pages, see IClientExtensionMode
    const mode = ExtensionModeHelper.getMode(this.extensions, this.game.getActiveExtension());
    if (mode != null) {
      const modePaths = ExtensionModeHelper.getPaths(mode.screenRoutes);
      return modePaths.includes(currentPath) || this.redirect(modePaths[0]);
    }
    switch (currentPath) {
      case pathsScreen.main:
        return this.handleMainRoute();
      case pathsScreen.connect:
        return this.handleConnectRoute();
      default:
        // e.g. a page of a mode that was switched off
        return this.handleMainRoute();
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
