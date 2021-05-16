import {ModuleWithProviders, NgModule} from '@angular/core';
import { CommonModule } from '@angular/common';
import {RouterModule, Routes} from '@angular/router';
import {StartComponent} from './master/start/start.component';


export const routes: Routes = [
  {
    path: 'master',
    loadChildren: () => import('./master/master.module').then(m => m.MasterModule)
  },
  // TODO: once available, let the base path point to the screen instead of the master
  { path: '', redirectTo: 'master', pathMatch: 'full' }
];



@NgModule({
  declarations: [],
  imports: [ RouterModule.forRoot(routes) ],
  exports: [ RouterModule ]
})
export class AppRoutingModule { }
