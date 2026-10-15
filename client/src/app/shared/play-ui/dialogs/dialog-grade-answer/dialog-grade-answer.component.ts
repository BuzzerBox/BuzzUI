import {Component, Inject} from '@angular/core';
import {MAT_DIALOG_DATA} from '@angular/material/dialog';
import {EGradeResults} from '../../../../../../../shared/shared';

export interface IDialogGradeAnswerData {
  teamName: string;
  // what the current question is worth
  points: number;
}

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

  constructor(@Inject(MAT_DIALOG_DATA) public data: IDialogGradeAnswerData) { }

  public formatPoints(points: number): string {
    return points === 1 ? '1 Punkt' : `${points} Punkte`;
  }
}
