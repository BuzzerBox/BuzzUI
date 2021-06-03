import {Component, Inject, OnInit} from '@angular/core';
import {MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef} from '@angular/material/bottom-sheet';

export interface IBottomSheetsAnswerOptionsData {
  isAnswerLoggedIn: boolean;
}

export enum EDecisionBottomSheetAnswerOptions {
  NOTHING,
  LOG_IN,
  LOG_OUT,
  ACTIVATE
}

@Component({
  selector: 'app-answer-options',
  templateUrl: './answer-options.component.html',
  styleUrls: ['./answer-options.component.css']
})
export class AnswerOptionsComponent {

  constructor(private bottomSheetRef: MatBottomSheetRef<AnswerOptionsComponent>, @Inject(MAT_BOTTOM_SHEET_DATA) private data: IBottomSheetsAnswerOptionsData) { }

  public isAlreadyLoggedIn(): boolean {
    return this.data.isAnswerLoggedIn;
  }

  public logInAnswer(): void {
    this.hideBottomSheet(EDecisionBottomSheetAnswerOptions.LOG_IN);
  }

  public logOutAnswer(): void {
    this.hideBottomSheet(EDecisionBottomSheetAnswerOptions.LOG_OUT);
  }

  public activateAnswer(): void {
    this.hideBottomSheet(EDecisionBottomSheetAnswerOptions.ACTIVATE);
  }

  private hideBottomSheet(returnVal: EDecisionBottomSheetAnswerOptions): void {
    this.bottomSheetRef.dismiss(returnVal);
  }

}
