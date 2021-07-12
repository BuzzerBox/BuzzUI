import { Component, OnInit } from '@angular/core';
import {AbstractControl, FormArray, FormControl, FormGroup, ValidationErrors, ValidatorFn, Validators} from '@angular/forms';
import {GameService, IGameStateAsJson} from '../../services/game.service';
import {MatCheckbox} from '@angular/material/checkbox';
import {ITeam, IQuestion, IBuzzer, IAnswer} from '../../../../../shared/shared';
import {SafeUrl} from '@angular/platform-browser';
import {File} from '@angular/compiler-cli/src/ngtsc/file_system/testing/src/mock_file_system';

@Component({
  selector: 'app-setup',
  templateUrl: './setup.component.html',
  styleUrls: ['./setup.component.css']
})
export class SetupComponent implements OnInit {
  public readonly FORM_GROUP_NAME_TEAMS = 'teamsFormGroup';
  public readonly ANSWER_FORM_GROUP_BASE_NAME = 'answer';

  public teamsFormGroup: FormGroup;
  public questionsFormGroup: FormGroup;
  public teamNameSuggestions: string[];
  public teamFormControlNames: string[];
  public questionFormGroupNames: string[];
  private mapTeamFormControlNameToBuzzerId: Map<string, string>;
  public hasReachedLastStep = false;

  constructor(private game: GameService) {
    game.useAsMaster();
  }

  ngOnInit(): void {
    this.mapTeamFormControlNameToBuzzerId = new Map<string, string>();
    this.initTeamsFormControls();
    this.initQuestionsFormControls();
  }

  public onChangeTeamCheckbox(cb: MatCheckbox, tb: HTMLInputElement, formGroupName: string): void {
    if (cb.checked) {
      this.teamsFormGroup.get(formGroupName).enable();
      tb.focus();
    } else {
      this.teamsFormGroup.get(formGroupName).disable();
    }
  }

  private initTeamsFormControls(loadedFromFile: boolean = false): void {
    // TODO refine such that there is no duplicated code
    this.teamFormControlNames = [];
    this.teamNameSuggestions = [];
    const teamFormControls: {
      [key: string]: AbstractControl;
    } = {};
    const presetupData = this.game.getPresetupData();
    if (loadedFromFile && this.game.getTeams() != null) {
      for (let i = 0; i < this.game.getTeams().length; i++) {
        const formControlName = 'team' + (i + 1);
        this.teamFormControlNames.push(formControlName);
        this.mapTeamFormControlNameToBuzzerId.set(formControlName, presetupData.availableBuzzers[i].id);
        const name: string = this.game.getTeams()[i].name;
        this.teamNameSuggestions.push(name);
        const formControlForTeam = new FormControl(name);
        teamFormControls[formControlName] = formControlForTeam;
      }
    } else {
      this.teamNameSuggestions = [];
      // const presetupData = this.game.getPresetupData();
      console.log('presetupData');
      console.log(presetupData);
      for (let i = 0; i < presetupData.availableBuzzers.length; i++) {
        const teamNameSuggestion = 'Team ' + (i + 1);
        this.teamNameSuggestions.push(teamNameSuggestion);
        const formControlName = 'team' + (i + 1);
        this.teamFormControlNames.push(formControlName);
        this.mapTeamFormControlNameToBuzzerId.set(formControlName, presetupData.availableBuzzers[i].id);
        const formControlForTeam = new FormControl(teamNameSuggestion);
        // const formControlForTeam = new FormControl();
        if (i >= 2) {
          // since two teams are mandatory, only all up from the third one get disabled
          formControlForTeam.disable();
        }
        teamFormControls[formControlName] = formControlForTeam;
      }
    }
    this.teamsFormGroup = new FormGroup(teamFormControls);
    console.log(this.teamsFormGroup);
  }

  private initQuestionsFormControls(): void {
    if (this.game.getQuestions() != null) {
      const questionsFormGroup = new FormGroup({});
      for (let i = 0; i < this.game.getQuestions().length; i++) {
        const q: IQuestion = this.game.getQuestions()[i];
        this.questionsFormGroup.addControl('question' + i, new FormGroup({
          text: new FormControl(q.text),
          answers: new FormGroup({
            answer0: new FormGroup({
              text: new FormControl(q.answers[0].text),
              isCorrect: new FormControl(q.answers[0].isCorrect)
            }),
            answer1: new FormGroup({
              text: new FormControl(q.answers[1].text),
              isCorrect: new FormControl(q.answers[1].isCorrect)
            }),
            answer2: new FormGroup({
              text: new FormControl(q.answers[2].text),
              isCorrect: new FormControl(q.answers[2].isCorrect)
            }),
            answer3: new FormGroup({
              text: new FormControl(q.answers[3].text),
              isCorrect: new FormControl(q.answers[3].isCorrect)
            })
          })
        }));
        // this.questionsFormGroup.updateValueAndValidity();
      }
    } else {
      this.questionsFormGroup = new FormGroup({});
      this.questionFormGroupNames = [];
    }
  }

  public addQuestionToFormGroup(): void {
    const qfc: FormGroup = this.createQuestionFormGroup();
    const formGroupName: string = 'question' + this.questionFormGroupNames.length;
    this.questionFormGroupNames.push(formGroupName);
    this.questionsFormGroup.addControl(formGroupName, qfc);
  }

  private createQuestionFormGroup(): FormGroup {
    return new FormGroup({
      text: new FormControl(null, Validators.required),
      answers: new FormGroup({
        answer0: this.createFormGroupForAnswer(),
        answer1: this.createFormGroupForAnswer(),
        answer2: this.createFormGroupForAnswer(),
        answer3: this.createFormGroupForAnswer()
      }, {validators: this.atLeastOneCorrectAnswerValidator()})
    });
  }

  private createFormGroupForAnswer(): FormGroup {
    return new FormGroup({
      text: new FormControl(null, Validators.required),
      isCorrect: new FormControl(false)
    });
  }

  public getQuestionFormGroup(name: string): FormGroup {
    return this.questionsFormGroup.get(name) as FormGroup;
  }

  public getAnswerFromGroup(questionName: string): FormGroup {
    return this.getQuestionFormGroup(questionName).get('answers') as FormGroup;
  }

  private atLeastOneCorrectAnswerValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const a0 = control.get(this.ANSWER_FORM_GROUP_BASE_NAME + '0').get('isCorrect');
      const a1 = control.get(this.ANSWER_FORM_GROUP_BASE_NAME + '1').get('isCorrect');
      const a2 = control.get(this.ANSWER_FORM_GROUP_BASE_NAME + '2').get('isCorrect');
      const a3 = control.get(this.ANSWER_FORM_GROUP_BASE_NAME + '3').get('isCorrect');
      const atLeastOneCorrectAnswer = a0.value || a1.value || a2.value || a3.value;
      return atLeastOneCorrectAnswer ? null : {error: 'needs at least one correct answer'};
    };
  }

  public getNumberOfQuestions(): number {
    return this.questionFormGroupNames.length;
  }

  public getNumberOfActiveTeams(): number {
    let count = 0;
    for (const name of this.teamFormControlNames) {
      if (!this.teamsFormGroup.get(name).disabled) {
        count++;
      }
    }
    return count;
  }

  public startGame(): void {
    const teams: ITeam[] = this.buildSetupTeamsObject();
    const questions: IQuestion[] = this.buildSetupQuestionsObject();
    this.game.setupGame(teams, questions);
  }

  private buildSetupTeamsObject(): ITeam[] {
    const ret: ITeam[] = [];
    for (const name of this.teamFormControlNames) {
      if (!this.teamsFormGroup.get(name).disabled) {
        const buzzerId = this.mapTeamFormControlNameToBuzzerId.get(name);
        ret.push({
          name: this.teamsFormGroup.get(name).value,
          buzzerId,
          teamId: buzzerId // use the buzzerId for now
        });
      }
    }
    return ret;
  }

  private buildSetupQuestionsObject(): IQuestion[] {
    const ret: IQuestion[] = [];
    for (const name of this.questionFormGroupNames) {
      const questionFormGroup: FormGroup = this.questionsFormGroup.get(name) as FormGroup;
      const questionText: string = questionFormGroup.get('text').value.toString();
      const answers: IAnswer[] = [];
      for (let i = 0; i < 4; i++) {
        const answerFormGroup: FormGroup = questionFormGroup.get('answers').get(this.ANSWER_FORM_GROUP_BASE_NAME + i) as FormGroup;
        answers.push({
          text: answerFormGroup.get('text').value.toString(),
          isCorrect: answerFormGroup.get('isCorrect').value
        });
      }
      ret.push({
        text: questionText,
        answers
      });
    }
    return ret;
  }

  public downloadSetupAsJson(): SafeUrl {
    if (!this.hasReachedLastStep) {
      return null;
    }
    const teams: ITeam[] = this.buildSetupTeamsObject();
    const questions: IQuestion[] = this.buildSetupQuestionsObject();
    this.game.setGameData(teams, questions);
    return this.game.exportGameStateAsJson();
  }

  public getGameName(): string {
    return this.game.getGameName();
  }

  // TODO: check that there are not more teams in the savegame as there are buzzers now. If there are, show some dialog to choose
  //  teams to be kept
  public onSaveGameFileSelected(uploadEvent): void {
    // if typed as File, the fileReader.readAsText complains
    const configFile: any = uploadEvent.target.files[0];
    const fileReader = new FileReader();
    fileReader.readAsText(configFile as Blob, 'UTF-8');
    fileReader.onload = async () => {
      const importedState: IGameStateAsJson = JSON.parse(fileReader.result as string);
      // await this.game.importGameStateFromJson(importedState, false);

      this.game.importGameStateFromJson(importedState);

      // this.initTeamsFormControls();
      // this.initQuestionsFormControls();
    };
  }

  public test(): string {
    // alert("test");
    console.log(this.questionFormGroupNames);
    console.log(this.questionsFormGroup);
    return "teee";
  }
}
