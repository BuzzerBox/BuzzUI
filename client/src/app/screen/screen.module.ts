import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MainComponent } from './main/main.component';
import {ScreenRoutingModule} from './screen.routing.module';
import {SharedModule} from '../shared/shared.module';
import { ConnectComponent } from './connect/connect.component';
import { TeamComponent } from './team/team.component';
import {MatIconModule} from '@angular/material/icon';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {MatCardModule} from '@angular/material/card';
import {MatButtonModule} from '@angular/material/button';



@NgModule({
  declarations: [
    MainComponent,
    ConnectComponent,
    TeamComponent
  ],
  imports: [
    CommonModule,
    ScreenRoutingModule,
    SharedModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatCardModule,
    MatButtonModule
  ]
})
export class ScreenModule { }
