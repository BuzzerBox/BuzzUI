import {CUSTOM_ELEMENTS_SCHEMA, NgModule} from '@angular/core';
import { CommonModule } from '@angular/common';
import {PlayUiComponent} from './play-ui/play-ui.component';
import {TeamCardComponent} from './play-ui/team-card/team-card.component';
import {QuestionPaneComponent} from './play-ui/question-pane/question-pane.component';
import {AnswerOptionsComponent} from './play-ui/bottom-sheets/answer-options/answer-options.component';
import {DialogConfirmEndingGameComponent} from './play-ui/dialogs/dialog-confirm-ending-game/dialog-confirm-ending-game.component';
import {DialogGradeAnswerComponent} from './play-ui/dialogs/dialog-grade-answer/dialog-grade-answer.component';
import {MatCardModule} from '@angular/material/card';
import {MatButtonModule} from '@angular/material/button';
import {MatDialogModule} from '@angular/material/dialog';
import {MatBottomSheetModule} from '@angular/material/bottom-sheet';
import {MatListModule} from '@angular/material/list';
import {MatSnackBarModule} from '@angular/material/snack-bar';
import { ScoreBoardComponent } from './play-ui/score-board/score-board.component';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import { BuzzerLockComponent } from './play-ui/buzzer-lock/buzzer-lock.component';
import { MediaQuestionComponent } from './play-ui/media-question/media-question.component';
import {VgCoreModule} from '@videogular/ngx-videogular/core';
import {VgControlsModule} from '@videogular/ngx-videogular/controls';
import {VgOverlayPlayModule} from '@videogular/ngx-videogular/overlay-play';
import {VgBufferingModule} from '@videogular/ngx-videogular/buffering';
import {MediaRemoteComponent} from './play-ui/media-remote/media-remote.component';
import {MatIconModule} from '@angular/material/icon';
import {MatSliderModule} from '@angular/material/slider';
import {FitTextDirective} from './fit-text.directive';
import {LoadingSpinnerComponent} from './loading-spinner/loading-spinner.component';
import {JeopardyBoardComponent} from './play-ui/jeopardy-board/jeopardy-board.component';

@NgModule({
    declarations: [
        PlayUiComponent,
        TeamCardComponent,
        QuestionPaneComponent,
        AnswerOptionsComponent,
        DialogConfirmEndingGameComponent,
        DialogGradeAnswerComponent,
        ScoreBoardComponent,
        BuzzerLockComponent,
        MediaQuestionComponent,
        MediaRemoteComponent,
        FitTextDirective,
        LoadingSpinnerComponent,
        JeopardyBoardComponent
    ],
    imports: [
        CommonModule,
        MatButtonModule,
        MatCardModule,
        MatDialogModule,
        MatBottomSheetModule,
        MatListModule,
        MatSnackBarModule,
        VgCoreModule,
        VgControlsModule,
        VgOverlayPlayModule,
        VgBufferingModule,
        MatIconModule,
        MatSliderModule,
        MatProgressSpinnerModule
    ],
    exports: [
        PlayUiComponent,
        TeamCardComponent,
        QuestionPaneComponent,
        AnswerOptionsComponent,
        DialogConfirmEndingGameComponent,
        MediaQuestionComponent,
        MediaRemoteComponent,
        LoadingSpinnerComponent
    ],
    schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class SharedModule { }
