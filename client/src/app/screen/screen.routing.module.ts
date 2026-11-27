import {NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
import {pathsScreen} from './paths-screen';
import {MainComponent} from './main/main.component';
import {ConnectComponent} from './connect/connect.component';
import {RouteGuard} from './guard/route.guard';
import {CLIENT_EXTENSIONS} from '../extensions/extensions';
import {ExtensionModeHelper} from '../extensions/extension-modes';

const routes: Routes = [
  { path: pathsScreen.root, redirectTo: pathsScreen.main, pathMatch: 'full'},
  { path: pathsScreen.main, component: MainComponent, canActivate: [RouteGuard]},
  { path: pathsScreen.connect, component: ConnectComponent, canActivate: [RouteGuard]},
  // the pages of the extensions' modes, only while the mode is on, see IClientExtensionMode
  ...CLIENT_EXTENSIONS.flatMap(extension => ExtensionModeHelper.guard(extension.mode?.screenRoutes ?? [], RouteGuard))
];

@NgModule({
  declarations: [],
  imports: [ RouterModule.forChild(routes)],
  exports: [ RouterModule ],
  providers: [RouteGuard]
})
export class ScreenRoutingModule { }
