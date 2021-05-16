import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StartComponent } from './start/start.component';
import {MasterRoutingModule} from './master.routing.module';
import { SetupComponent } from './setup/setup.component';
import { MasterAlreadyRegisteredComponent } from './master-already-registered/master-already-registered.component';
import { ToolbarMasterComponent } from './toolbar-master/toolbar-master.component';
import {MatToolbarModule} from '@angular/material/toolbar';
import {MatIconModule} from '@angular/material/icon';
import {MatButtonModule} from '@angular/material/button';



@NgModule({
  declarations: [
    StartComponent,
    SetupComponent,
    MasterAlreadyRegisteredComponent,
    ToolbarMasterComponent
  ],
  imports: [
    CommonModule,
    MasterRoutingModule,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule
  ],
  exports: [
    StartComponent
  ]
})
export class MasterModule { }
