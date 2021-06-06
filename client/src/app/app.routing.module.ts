import {ModuleWithProviders, NgModule} from '@angular/core';
import { CommonModule } from '@angular/common';
import {RouterModule, Routes} from '@angular/router';
import {StartComponent} from './master/start/start.component';
import {ChooseComponent} from './choose/choose.component';


export const routes: Routes = [
  {
    path: 'master',
    loadChildren: () => import('./master/master.module').then(m => m.MasterModule)
  },
  {
    path: 'screen',
    loadChildren: () => import('./screen/screen.module').then(m => m.ScreenModule)
  },
  { path: 'choose', component: ChooseComponent },
  { path: '', redirectTo: 'choose', pathMatch: 'full' }
];



@NgModule({
  declarations: [],
  imports: [ RouterModule.forRoot(routes) ],
  exports: [ RouterModule ]
})
export class AppRoutingModule { }
