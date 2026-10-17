import {Component, Inject} from '@angular/core';
import {MAT_DIALOG_DATA} from '@angular/material/dialog';
import {EGradeResults} from '../../../../../../../shared/shared';

export interface IDialogGradeAnswerData {
  teamName: string;
  // what the current question is worth
  points: number;
}

/**
 * The dialog's result for releasing the buzzers without grading the answer, e.g. when a team buzzed by mistake
 */
export const RELEASE_WITHOUT_GRADE = 'release';

export type TGradeDialogResult = EGradeResults | typeof RELEASE_WITHOUT_GRADE;

/**
 * Opens on the master when a team buzzed; closes with how its answer was graded
 */
@Component({
    selector: 'app-dialog-grade-answer',
    templateUrl: './dialog-grade-answer.component.html',
    styleUrls: ['./dialog-grade-answer.component.css'],
    standalone: false
})
export class DialogGradeAnswerComponent {
  public readonly EGradeResults = EGradeResults;
  public readonly RELEASE_WITHOUT_GRADE = RELEASE_WITHOUT_GRADE;

  constructor(@Inject(MAT_DIALOG_DATA) public data: IDialogGradeAnswerData) { }

  public formatPoints(points: number): string {
    return points === 1 ? '1 Punkt' : `${points} Punkte`;
  }
}
