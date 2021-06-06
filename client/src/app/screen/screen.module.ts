import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MainComponent } from './main/main.component';
import {ScreenRoutingModule} from './screen.routing.module';
import {SharedModule} from '../shared/shared.module';
import { ConnectComponent } from './connect/connect.component';



@NgModule({
  declarations: [
    MainComponent,
    ConnectComponent
  ],
  imports: [
    CommonModule,
    ScreenRoutingModule,
    SharedModule
  ]
})
export class ScreenModule { }
