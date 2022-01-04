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
import {MatCardModule} from '@angular/material/card';
import {SharedModule} from '../shared/shared.module';
import {MatBottomSheetModule} from '@angular/material/bottom-sheet';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {MatTooltipModule} from '@angular/material/tooltip';
import {MatListModule} from '@angular/material/list';
import {MatExpansionModule} from '@angular/material/expansion';
import {SelectMediaComponent} from './select-media/select-media.component';
import {FileUploadFormComponent} from './file-upload-form/file-upload-form.component';
import {MatTreeModule} from '@angular/material/tree';
import { FileDropEventsDirective } from './file-drop-events.directive';

@NgModule({
  declarations: [
    StartComponent,
    SetupComponent,
    MasterAlreadyRegisteredComponent,
    ToolbarMasterComponent,
    ErrorPageComponent,
    StartGameComponent,
    PlayComponent,
    SelectMediaComponent,
    FileUploadFormComponent,
    FileDropEventsDirective
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
    SharedModule,
    MatBottomSheetModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatListModule,
    MatExpansionModule,
    MatTreeModule,
  ],
  exports: [
    StartComponent
  ]
})
export class MasterModule { }
