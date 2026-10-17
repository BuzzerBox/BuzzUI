import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {StartComponent} from './start/start.component';
import {RouteGuard} from './guards/route.guard';
import {SetupComponent} from './setup/setup.component';
import {MasterAlreadyRegisteredComponent} from './master-already-registered/master-already-registered.component';
import {pathsMaster} from './paths-master';
import {PlayComponent} from './play/play.component';
import {HomeComponent} from './home/home.component';
import {LoadGameComponent} from './load-game/load-game.component';
import {StorageManagerComponent} from './storage-manager/storage-manager.component';
import {PrepareGameComponent} from './prepare-game/prepare-game.component';

const routes: Routes = [
  { path: pathsMaster.root, redirectTo: 'start', pathMatch: 'full'},
  { path: pathsMaster.start, component: StartComponent, canActivate: [RouteGuard]},
  { path: pathsMaster.home, component: HomeComponent, canActivate: [RouteGuard]},
  { path: pathsMaster.setup, component: SetupComponent, canActivate: [RouteGuard]},
  { path: pathsMaster.loadGame, component: LoadGameComponent, canActivate: [RouteGuard]},
  { path: pathsMaster.storage, component: StorageManagerComponent, canActivate: [RouteGuard]},
  { path: pathsMaster.prepare, component: PrepareGameComponent, canActivate: [RouteGuard]},
  { path: pathsMaster.masterAlreadyRegistered, component: MasterAlreadyRegisteredComponent, canActivate: [RouteGuard]},
  { path: pathsMaster.play, component: PlayComponent, canActivate: [RouteGuard]}
];

@NgModule({
  declarations: [],
  imports: [ RouterModule.forChild(routes)],
  exports: [ RouterModule ],
  providers: [RouteGuard]
})
export class MasterRoutingModule { }
