import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {pathsScreen} from './paths-screen';
import {MainComponent} from './main/main.component';
import {ConnectComponent} from './connect/connect.component';
import {RouteGuard} from './guard/route.guard';

const routes: Routes = [
  { path: pathsScreen.root, redirectTo: pathsScreen.main, pathMatch: 'full'},
  { path: pathsScreen.main, component: MainComponent, canActivate: [RouteGuard]},
  { path: pathsScreen.connect, component: ConnectComponent, canActivate: [RouteGuard]}
];

@NgModule({
  declarations: [],
  imports: [ RouterModule.forChild(routes)],
  exports: [ RouterModule ],
  providers: [RouteGuard]
})
export class ScreenRoutingModule { }
