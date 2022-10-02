import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Routes, RouterModule } from '@angular/router';
import { VirtualDevBoardComponent } from './virtual-dev-board.component';
import {MatButtonToggleModule} from '@angular/material/button-toggle';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {SharedModule} from '../shared/shared.module';


const routes: Routes = [
  { path: '', component: VirtualDevBoardComponent }
];

@NgModule({
  declarations: [
    VirtualDevBoardComponent
  ],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    MatButtonToggleModule,
    MatProgressSpinnerModule,
    SharedModule
  ]
})
export class VirtualDevBoardModule { }
