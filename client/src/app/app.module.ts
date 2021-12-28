import {CUSTOM_ELEMENTS_SCHEMA, NgModule} from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app.routing.module';
import {MasterRoutingModule} from './master/master.routing.module';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ChooseComponent } from './choose/choose.component';
import {FlexModule} from '@angular/flex-layout';
import {MatButtonModule} from '@angular/material/button';
import {MatCardModule} from '@angular/material/card';
import { TeamCardComponent } from './shared/play-ui/team-card/team-card.component';
import { QuestionPaneComponent } from './shared/play-ui/question-pane/question-pane.component';
import {MatGridListModule} from '@angular/material/grid-list';
import { AnswerOptionsComponent } from './shared/play-ui/bottom-sheets/answer-options/answer-options.component';
import {MatBottomSheetModule} from '@angular/material/bottom-sheet';
import {MatListModule} from '@angular/material/list';
import {MatSnackBarModule} from '@angular/material/snack-bar';
import { DialogConfirmEndingGameComponent } from './shared/play-ui/dialogs/dialog-confirm-ending-game/dialog-confirm-ending-game.component';
import {MatDialogModule} from '@angular/material/dialog';

@NgModule({
  declarations: [
    AppComponent,
    ChooseComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    AppRoutingModule,
    MasterRoutingModule,
    FlexModule,
    MatButtonModule,
    // MatCardModule,
    // MatGridListModule,
    MatBottomSheetModule,
    // MatListModule,
    MatSnackBarModule,
    MatDialogModule,
  ],
  providers: [],
  bootstrap: [AppComponent],
  exports: [
  ]
})
export class AppModule { }
