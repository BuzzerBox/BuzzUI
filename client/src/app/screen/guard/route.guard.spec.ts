import {TestBed} from '@angular/core/testing';
import {ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlSegment, UrlTree} from '@angular/router';
import {RouteGuard} from './route.guard';
import {GameService} from '../../services/game.service';
import {pathsScreen} from '../paths-screen';
import {CLIENT_EXTENSION_LIST} from '../../extensions/extension-modes';
import {IClientExtension} from '../../extensions/client-extension';

class StubComponent {}

const EXTENSIONS: IClientExtension[] = [{
  id: 'games',
  mode: {
    icon: 'mic', titleKey: 'ext.games.title', textKey: 'ext.games.text',
    masterRoutes: [{path: 'games', component: StubComponent}],
    screenRoutes: [{path: 'games', component: StubComponent}, {path: 'games/results', component: StubComponent}]
  }
}];

describe('Screen RouteGuard', () => {
  let activeExtension: string | null;
  let dataAvailable: boolean;
  let guard: RouteGuard;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        RouteGuard,
        {provide: GameService, useValue: {useAsScreen: () => undefined, dataAvailable: () => dataAvailable,
            getActiveExtension: () => activeExtension}},
        {provide: CLIENT_EXTENSION_LIST, useValue: EXTENSIONS}
      ]
    });
    guard = TestBed.inject(RouteGuard);
    router = TestBed.inject(Router);
    activeExtension = null;
    dataAvailable = false;
  });

  const open = (path: string) => {
    const route = {url: path.split('/').map(segment => new UrlSegment(segment, {}))} as unknown as ActivatedRouteSnapshot;
    return guard.canActivate(route, {} as RouterStateSnapshot);
  };

  const target = (result: unknown): string => router.serializeUrl(result as UrlTree);

  it('waits on the connect page until a game is there, as before', () => {
    expect(target(open(pathsScreen.main))).toBe('/screen/' + pathsScreen.connect);
    expect(open(pathsScreen.connect)).toBe(true);
    dataAvailable = true;
    expect(open(pathsScreen.main)).toBe(true);
  });

  it('only shows the pages of the mode that is on, starting with its first', () => {
    activeExtension = 'games';
    expect(open('games')).toBe(true);
    expect(open('games/results')).toBe(true);
    expect(target(open(pathsScreen.main))).toBe('/screen/games');
    expect(target(open(pathsScreen.connect))).toBe('/screen/games');
  });

  it('goes back to the quiz from a page of a mode that was switched off', () => {
    expect(target(open('games'))).toBe('/screen/' + pathsScreen.connect);
  });
});
