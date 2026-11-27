import {TestBed} from '@angular/core/testing';
import {ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlSegment, UrlTree} from '@angular/router';
import {RouteGuard} from './route.guard';
import {GameService} from '../../services/game.service';
import {EGameStatesMaster} from '../enums/EGameStatesMaster';
import {pathsMaster} from '../paths-master';
import {CLIENT_EXTENSION_LIST} from '../../extensions/extension-modes';
import {IClientExtension} from '../../extensions/client-extension';

class StubComponent {}

const EXTENSIONS: IClientExtension[] = [{
  id: 'games',
  masterRoutes: [{path: 'games-settings', component: StubComponent}],
  mode: {
    icon: 'mic', titleKey: 'ext.games.title', textKey: 'ext.games.text',
    masterRoutes: [{path: 'games', component: StubComponent}, {path: 'games/library', component: StubComponent}],
    screenRoutes: [{path: 'games', component: StubComponent}]
  }
}];

describe('RouteGuard', () => {
  let state: EGameStatesMaster;
  let activeExtension: string | null;
  let guard: RouteGuard;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        RouteGuard,
        {provide: GameService, useValue: {useAsMaster: () => undefined, getGameState: () => state, getActiveExtension: () => activeExtension}},
        {provide: CLIENT_EXTENSION_LIST, useValue: EXTENSIONS}
      ]
    });
    activeExtension = null;
    guard = TestBed.inject(RouteGuard);
    router = TestBed.inject(Router);
  });

  const open = (path: string) => {
    const route = {url: path.split('/').map(segment => new UrlSegment(segment, {}))} as unknown as ActivatedRouteSnapshot;
    return guard.canActivate(route, {} as RouterStateSnapshot);
  };

  const target = (result: unknown): string => router.serializeUrl(result as UrlTree);

  const allPaths = [pathsMaster.start, pathsMaster.home, pathsMaster.setup, pathsMaster.loadGame, pathsMaster.prepare,
    pathsMaster.storage, pathsMaster.masterAlreadyRegistered, pathsMaster.play];

  const allStates = Object.values(EGameStatesMaster).filter(value => typeof value === 'number') as EGameStatesMaster[];

  it('leads every page to one that lets the master in, so redirects never go in circles', () => {
    for (const s of allStates) {
      state = s;
      for (const path of allPaths) {
        const result = open(path);
        if (result !== true) {
          const redirectedTo = target(result).replace('/master/', '');
          expect(open(redirectedTo)).withContext(`${EGameStatesMaster[s]}: ${path} -> ${redirectedTo}`).toBe(true);
        }
      }
    }
  });

  it('takes a master back to its start page after the server was reset in the middle of the setup', () => {
    state = EGameStatesMaster.RECEIVED_PRESETUP_DATA;
    expect(target(open(pathsMaster.start))).toBe('/master/' + pathsMaster.home);
  });

  it('shows the scores again, not the already registered page, after the game ended', () => {
    state = EGameStatesMaster.END;
    expect(target(open(pathsMaster.start))).toBe('/master/' + pathsMaster.play);
    expect(target(open(pathsMaster.masterAlreadyRegistered))).toBe('/master/' + pathsMaster.play);
  });

  it('shows the already registered page only to a refused master', () => {
    state = EGameStatesMaster.REJECTED;
    expect(open(pathsMaster.masterAlreadyRegistered)).toBe(true);
    expect(target(open(pathsMaster.home))).toBe('/master/' + pathsMaster.masterAlreadyRegistered);
  });

  it('lets the master open the pages of the extensions while no game is set up, but not those of their modes', () => {
    state = EGameStatesMaster.RECEIVED_PRESETUP_DATA;
    expect(open('games-settings')).toBe(true);
    expect(target(open('games'))).toBe('/master/' + pathsMaster.home);
    state = EGameStatesMaster.PLAYING;
    expect(target(open('games-settings'))).toBe('/master/' + pathsMaster.play);
  });

  it('only shows the pages of the mode that is on, starting with its first', () => {
    state = EGameStatesMaster.RECEIVED_PRESETUP_DATA;
    activeExtension = 'games';
    expect(open('games')).toBe(true);
    expect(open('games/library')).toBe(true);
    expect(target(open(pathsMaster.home))).toBe('/master/games');
    expect(target(open(pathsMaster.setup))).toBe('/master/games');
    expect(target(open('games-settings'))).toBe('/master/games');
  });

  it('ignores a mode this build doesn\'t know', () => {
    state = EGameStatesMaster.RECEIVED_PRESETUP_DATA;
    activeExtension = 'unknown';
    expect(open(pathsMaster.home)).toBe(true);
  });
});
