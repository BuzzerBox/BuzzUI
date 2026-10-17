import {Component, Inject} from '@angular/core';
import {MAT_DIALOG_DATA} from '@angular/material/dialog';
import {EGradeResults, IAnswer} from '../../../../../../../shared/shared';

export interface IDialogGradeAnswerOption {
  answer: IAnswer;
  // A, B, C, … as in the question pane
  letter: string;
  // revealed answers can't be given again
  isRevealed: boolean;
}

export interface IDialogGradeAnswerData {
  teamName: string;
  // what the current question is worth
  points: number;
  // the answer options, to pick the one the team gave; empty for a question without answer options
  answers: IDialogGradeAnswerOption[];
  // the screens don't show the answers yet, e.g. until the media ended
  answersHiddenOnScreens: boolean;
}

/**
 * The dialog's result for releasing the buzzers without grading the answer, e.g. when a team buzzed by mistake
 */
export const RELEASE_WITHOUT_GRADE = 'release';

export interface IGradeDialogGrade {
  result: EGradeResults;
  // the answer option the team gave, if the master picked one
  answer?: IAnswer;
}

/**
 * Closing it without a result (also with "Später bewerten") leaves the team marked and the buzzers locked
 */
export type TGradeDialogResult = IGradeDialogGrade | typeof RELEASE_WITHOUT_GRADE;

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
  public selectedAnswer: IAnswer | null = null;

  constructor(@Inject(MAT_DIALOG_DATA) public data: IDialogGradeAnswerData) { }

  public formatPoints(points: number): string {
    return points === 1 ? '1 Punkt' : `${points} Punkte`;
  }

  /**
   * Picking the selected answer again unselects it
   */
  public toggleAnswer(answer: IAnswer): void {
    this.selectedAnswer = this.selectedAnswer === answer ? null : answer;
  }

  /**
   * A picked answer decides the grade: a correct one can't be graded as wrong, a wrong one not as correct or double
   */
  public isAllowed(result: EGradeResults): boolean {
    if (this.selectedAnswer == null) {
      return true;
    }
    return this.selectedAnswer.isCorrect ? result !== EGradeResults.WRONG : result === EGradeResults.WRONG;
  }

  public grade(result: EGradeResults): IGradeDialogGrade {
    return this.selectedAnswer ? {result, answer: this.selectedAnswer} : {result};
  }
}
