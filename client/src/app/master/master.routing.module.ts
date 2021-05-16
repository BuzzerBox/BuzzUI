import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {StartComponent} from './start/start.component';
import {RouteGuard} from './guards/route.guard';
import {SetupComponent} from './setup/setup.component';
import {MasterAlreadyRegisteredComponent} from './master-already-registered/master-already-registered.component';
import {pathsMaster} from './paths-master';

const routes: Routes = [
  { path: pathsMaster.root, redirectTo: 'start', pathMatch: 'full'},
  { path: pathsMaster.start, component: StartComponent, canActivate: [RouteGuard]},
  { path: pathsMaster.setup, component: SetupComponent, canActivate: [RouteGuard]},
  { path: pathsMaster.masterAlreadyRegistered, component: MasterAlreadyRegisteredComponent, canActivate: [RouteGuard]}
];

@NgModule({
  declarations: [],
  imports: [ RouterModule.forChild(routes)],
  exports: [ RouterModule ],
  providers: [RouteGuard]
})
export class MasterRoutingModule { }
