import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import {Observable} from 'rxjs';
import {GameService} from '../../services/game.service';
import {inject, Injectable} from '@angular/core';
import {EGameStatesMaster} from '../enums/EGameStatesMaster';
import {pathsMaster} from '../paths-master';
import {CLIENT_EXTENSION_LIST, ExtensionModeHelper} from '../../extensions/extension-modes';

/**
 * The pages the master may show in each state; the first one is where it goes when it opens any other page
 */
const pathsForState: Record<EGameStatesMaster, string[]> = {
  [EGameStatesMaster.STARTING]: [pathsMaster.start],
  [EGameStatesMaster.MASTER_ACCEPTED]: [pathsMaster.start],
  // like the setup, these are only there while no game is set up
  [EGameStatesMaster.RECEIVED_PRESETUP_DATA]: [pathsMaster.home, pathsMaster.setup, pathsMaster.loadGame, pathsMaster.prepare, pathsMaster.storage,
    pathsMaster.settings],
  // only until the server answers the START_GAME the master sends right after the setup or a rejoin
  [EGameStatesMaster.READY_TO_START]: [pathsMaster.play],
  [EGameStatesMaster.PLAYING]: [pathsMaster.play],
  // the play page shows the scores then
  [EGameStatesMaster.END]: [pathsMaster.play],
  [EGameStatesMaster.REJECTED]: [pathsMaster.masterAlreadyRegistered]
};

@Injectable()
export class RouteGuard  {
  private readonly extensions = inject(CLIENT_EXTENSION_LIST);

  constructor(private game: GameService, private router: Router) {
    game.useAsMaster();
  }

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    // as the route config has it, so that an extension's paths may have several segments
    const currentPath = route.routeConfig?.path ?? route.url.map(segment => segment.path).join('/');
    const allowedPaths = this.getAllowedPaths();
    // a page of another state leads to the one of the current state, which always lets the master in
    return allowedPaths.includes(currentPath) || this.redirect(allowedPaths[0]);
  }

  /**
   * The pages of the state; while no game is set up also the extensions' (IClientExtension.masterRoutes), or only
   * those of the mode that is on (IClientExtensionMode), which starts with the one the master goes to
   */
  private getAllowedPaths(): string[] {
    const state = this.game.getGameState();
    if (state !== EGameStatesMaster.RECEIVED_PRESETUP_DATA) {
      return pathsForState[state];
    }
    const mode = ExtensionModeHelper.getMode(this.extensions, this.game.getActiveExtension());
    if (mode != null) {
      return ExtensionModeHelper.getPaths(mode.masterRoutes);
    }
    return [...pathsForState[state], ...this.extensions.flatMap(extension => ExtensionModeHelper.getPaths(extension.masterRoutes))];
  }

  private redirect(target: string): UrlTree {
    return this.router.createUrlTree(['master/' + target]);
  }
}
