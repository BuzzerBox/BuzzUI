import { NgModule } from '@angular/core';
import { AsyncPipe, CommonModule } from '@angular/common';
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
import {DragDropModule} from '@angular/cdk/drag-drop';
import { FileDropEventsDirective } from './file-drop-events.directive';
import { MediaQuestionDisplayOrderConfigurationComponent } from './media-question-display-order-configuration/media-question-display-order-configuration.component';
import {MatButtonToggleModule} from '@angular/material/button-toggle';
import {MatDialogModule} from '@angular/material/dialog';
import {DialogTeamsComponent} from './dialog-teams/dialog-teams.component';
import {UpdateCardComponent} from './update-card/update-card.component';
import {FormsModule} from '@angular/forms';
import {MatTabsModule} from '@angular/material/tabs';
import {MatRadioModule} from '@angular/material/radio';
import {MatProgressBarModule} from '@angular/material/progress-bar';
import {MatMenuModule} from '@angular/material/menu';
import {MatSlideToggleModule} from '@angular/material/slide-toggle';
import {HomeComponent} from './home/home.component';
import {LoadGameComponent} from './load-game/load-game.component';
import {StorageManagerComponent} from './storage-manager/storage-manager.component';
import {StorageLocationsComponent} from './storage-locations/storage-locations.component';
import {GameListComponent} from './game-list/game-list.component';
import {GameImportComponent} from './game-import/game-import.component';
import {PrepareGameComponent} from './prepare-game/prepare-game.component';
import {DialogCopyMediaComponent} from './dialog-copy-media/dialog-copy-media.component';
import {DialogEditGameComponent} from './dialog-edit-game/dialog-edit-game.component';
import {DialogEditStateComponent} from './dialog-edit-state/dialog-edit-state.component';
import {DialogEditMediaComponent} from './dialog-edit-media/dialog-edit-media.component';
import {MediaBrowserComponent} from './media-browser/media-browser.component';
import {DialogConfirmComponent} from './dialog-confirm/dialog-confirm.component';

@NgModule({
  declarations: [
    StartComponent,
    SetupComponent,
    MasterAlreadyRegisteredComponent,
    ToolbarMasterComponent,
    ErrorPageComponent,
    PlayComponent,
    SelectMediaComponent,
    FileUploadFormComponent,
    FileDropEventsDirective,
    DialogTeamsComponent,
    UpdateCardComponent,
    HomeComponent,
    LoadGameComponent,
    StorageManagerComponent,
    StorageLocationsComponent,
    GameListComponent,
    GameImportComponent,
    PrepareGameComponent,
    DialogCopyMediaComponent,
    DialogEditGameComponent,
    DialogEditStateComponent,
    DialogEditMediaComponent,
    MediaBrowserComponent,
    DialogConfirmComponent,
  ],
  imports: [
    CommonModule,
    AsyncPipe,
    MasterRoutingModule,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    ReactiveFormsModule,
    FormsModule,
    MatTabsModule,
    MatRadioModule,
    MatProgressBarModule,
    MatMenuModule,
    MatSlideToggleModule,
    MatStepperModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    MatCardModule,
    SharedModule,
    MatBottomSheetModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatListModule,
    MatExpansionModule,
    MatTreeModule,
    DragDropModule,
    MatButtonToggleModule,
    MatDialogModule,
    MediaQuestionDisplayOrderConfigurationComponent,
  ],
  exports: [
    StartComponent
  ]
})
export class MasterModule { }
