import { NgModule} from '@angular/core';
import {RouterModule, Routes} from '@angular/router';
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
  { path: '', redirectTo: 'choose', pathMatch: 'full' },
  { path: 'dev-board', loadChildren: () => import('./virtual-dev-board/virtual-dev-board.module').then(m => m.VirtualDevBoardModule) }
];



@NgModule({
  declarations: [],
  imports: [ RouterModule.forRoot(routes) ],
  exports: [ RouterModule ]
})
export class AppRoutingModule { }
