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
import { ErrorPageComponent } from './error-page/error-page.component';
import {ReactiveFormsModule} from '@angular/forms';
import {MatStepperModule} from '@angular/material/stepper';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatCheckboxModule} from '@angular/material/checkbox';
import {FlexModule} from '@angular/flex-layout';
import { StartGameComponent } from './start-game/start-game.component';
import { PlayComponent } from './play/play.component';
import { PlayUiComponent } from '../play-ui/play-ui.component';
import {MatCardModule} from '@angular/material/card';
import {AppModule} from '../app.module';



@NgModule({
  declarations: [
    StartComponent,
    SetupComponent,
    MasterAlreadyRegisteredComponent,
    ToolbarMasterComponent,
    ErrorPageComponent,
    StartGameComponent,
    PlayComponent,
    PlayUiComponent
  ],
  imports: [
    CommonModule,
    MasterRoutingModule,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    ReactiveFormsModule,
    MatStepperModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    FlexModule,
    MatCardModule,
    AppModule
  ],
  exports: [
    StartComponent
  ]
})
export class MasterModule { }
