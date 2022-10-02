import {RouterModule, Routes} from '@angular/router';
import {RouteGuard} from '../screen/guard/route.guard';
import {NgModule} from '@angular/core';

export const paths = {
  root: '',
  main: 'main'
};

const routes: Routes = [
  // { path: paths.root, redirectTo: paths.main, pathMatch: 'full'},
  // { path: paths.main, component: MainComponent},
];

@NgModule({
  declarations: [],
  imports: [ RouterModule.forChild(routes)],
  exports: [ RouterModule ],
  providers: [RouteGuard]
})
export class VirtualDevBoardRoutingModule { }
