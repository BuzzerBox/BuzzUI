import {ModuleWithProviders, NgModule} from '@angular/core';
import { CommonModule } from '@angular/common';
import {RouterModule, Routes} from '@angular/router';
import {StartComponent} from './master/start/start.component';
import {ChooseComponent} from './choose/choose.component';
import {touchDisplayGuard} from './helper/kiosk.helper';


export const routes: Routes = [
  {
    path: 'master',
    loadChildren: () => import('./master/master.module').then(m => m.MasterModule)
  },
  {
    path: 'screen',
    canActivate: [touchDisplayGuard],
    loadChildren: () => import('./screen/screen.module').then(m => m.ScreenModule)
  },
  { path: 'choose', component: ChooseComponent, canActivate: [touchDisplayGuard] },
  { path: '', redirectTo: 'choose', pathMatch: 'full' },
  {
    path: 'dev-board',
    canActivate: [touchDisplayGuard],
    loadChildren: () => import('./virtual-dev-board/virtual-dev-board.module').then(m => m.VirtualDevBoardModule)
  }
];



@NgModule({
  declarations: [],
  imports: [ RouterModule.forRoot(routes) ],
  exports: [ RouterModule ]
})
export class AppRoutingModule { }
