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
import { TeamCardComponent } from './play-ui/team-card/team-card.component';
import { QuestionPaneComponent } from './play-ui/question-pane/question-pane.component';
import {MatGridListModule} from '@angular/material/grid-list';

@NgModule({
  declarations: [
    AppComponent,
    ChooseComponent,
    TeamCardComponent,
    QuestionPaneComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    MasterRoutingModule,
    BrowserAnimationsModule,
    FlexModule,
    MatButtonModule,
    MatCardModule,
    MatGridListModule
  ],
  providers: [],
  bootstrap: [AppComponent],
  exports: [
    TeamCardComponent,
    QuestionPaneComponent
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class AppModule { }
