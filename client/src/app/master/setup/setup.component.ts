import {ChangeDetectorRef, Component, OnInit, ViewChild} from '@angular/core';
import {AbstractControl, FormControl, FormGroup, ValidationErrors, ValidatorFn, Validators} from '@angular/forms';
import {GameService, IGameStateAsJson} from '../../services/game.service';
import {MatCheckbox} from '@angular/material/checkbox';
import {ITeam, IQuestion, IAnswer} from '../../../../../shared/shared';
import {SafeUrl} from '@angular/platform-browser';
import {Observable, Subject} from 'rxjs';
import {MatSnackBar} from '@angular/material/snack-bar';
import {IUploadFormData} from '../interfaces/IUploadFormData';
import {ConfigService} from '../../services/config.service';

@Component({
  selector: 'app-setup',
  templateUrl: './setup.component.html',
  styleUrls: ['./setup.component.css']
})
export class SetupComponent implements OnInit {
  public readonly FORM_GROUP_NAME_TEAMS = 'teamsFormGroup';
  public readonly ANSWER_FORM_GROUP_BASE_NAME = 'answer';

  @ViewChild('questionForm') questionForm;

  public testSub: Subject<FormGroup> = new Subject<FormGroup>();
  public testObs: Observable<FormGroup> = this.testSub.asObservable();

  public teamsFormGroup: FormGroup;
  public questionsFormGroup: FormGroup;
  public teamNameSuggestions: string[];
  public teamFormControlNames: string[];
  public questionFormGroupNames: string[];
  private mapTeamFormControlNameToBuzzerId: Map<string, string>;
  public hasReachedLastStep = false;
  // public showQuestions = true;

  step = 0;


  constructor(private game: GameService, private cd: ChangeDetectorRef, private snackBar: MatSnackBar) {
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
          // formControlForTeam.disable();
        }
        teamFormControls[formControlName] = formControlForTeam;
      }
    }
    this.teamsFormGroup = new FormGroup(teamFormControls);
  }

  private initQuestionsFormControls(loadedFile: boolean = false): void {
    if (loadedFile) {
      for (let i = 0; i < this.game.getQuestions().length; i++) {
        const q: IQuestion = this.game.getQuestions()[i];
        const fgn = 'question' + i;
        let mediaSrc = '';
        if (q.mediaDetails) {
          mediaSrc = q.mediaDetails.fileSrc;
        }
        this.questionsFormGroup.addControl(fgn, new FormGroup({
          text: new FormControl(q.text),
          mediaSrc: new FormControl({value: mediaSrc, disable: true}),
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
          }),
          answersVisible: new FormControl(q.show)
        }));
        if (!q.show) {
          this.applyShowAnswersState(fgn, false);
        }
        this.addQuestionToFormGroup();
      }
    } else {
      this.questionsFormGroup = new FormGroup({});
      this.questionFormGroupNames = [];
      this.addQuestionToFormGroup();
    }
  }

  public addQuestionToFormGroup(): void {
    const qfc: FormGroup = this.createQuestionFormGroup();
    const formGroupName: string = 'question' + this.questionFormGroupNames.length;
    this.questionFormGroupNames.push(formGroupName);
    this.questionsFormGroup.addControl(formGroupName, qfc);
    this.setStep(this.questionFormGroupNames.length - 1);
  }

  private createQuestionFormGroup(): FormGroup {
    return new FormGroup({
      text: new FormControl(null, Validators.required),
      mediaSrc: new FormControl({value: '', disabled: true}),
      answers: new FormGroup({
        answer0: this.createFormGroupForAnswer(),
        answer1: this.createFormGroupForAnswer(),
        answer2: this.createFormGroupForAnswer(),
        answer3: this.createFormGroupForAnswer()
      }, {validators: this.atLeastOneCorrectAnswer()}),
      answersVisible: new FormControl(true)
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

  private atLeastOneCorrectAnswer(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const ac0 = control.get(this.ANSWER_FORM_GROUP_BASE_NAME + '0');
      const ac1 = control.get(this.ANSWER_FORM_GROUP_BASE_NAME + '1');
      const ac2 = control.get(this.ANSWER_FORM_GROUP_BASE_NAME + '2');
      const ac3 = control.get(this.ANSWER_FORM_GROUP_BASE_NAME + '3');
      const a0 = ac0.get('isCorrect');
      const a1 = ac1.get('isCorrect');
      const a2 = ac2.get('isCorrect');
      const a3 = ac3.get('isCorrect');
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
    this.game.setupGame(teams, questions, this.game.getGameStateData());
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
      const mediaSrc: string = questionFormGroup.get('mediaSrc').value.toString();
      const answers: IAnswer[] = [];
      for (let i = 0; i < 4; i++) {
        const answerFormGroup: FormGroup = questionFormGroup.get('answers').get(this.ANSWER_FORM_GROUP_BASE_NAME + i) as FormGroup;
        answers.push({
          text: answerFormGroup.get('text').value.toString(),
          isCorrect: answerFormGroup.get('isCorrect').value
        });
      }
      const question: IQuestion = {
        text: questionText,
        answers,
        show: questionFormGroup.get('answersVisible').value as boolean
      };
      if (mediaSrc) {
        question.mediaDetails = {
          fileSrc: mediaSrc
        };
      }
      ret.push(question);
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
  public onSaveGameFileSelected(uploadEvent: IUploadFormData): void {
    if (uploadEvent.data) {
      this.snackBar.open('Datei wird importiert, bitte warten...');
      // if typed as File, the fileReader.readAsText complains
      const configFile: any = uploadEvent.data;
      const fileReader = new FileReader();
      fileReader.readAsText(configFile as Blob, 'UTF-8');
      fileReader.onload = async () => {
        const importedState: IGameStateAsJson = JSON.parse(fileReader.result as string);
        await this.game.importGameStateFromJson(importedState, false);

        // this.game.importGameStateFromJson(importedState);

        this.initTeamsFormControls(true);
        this.initQuestionsFormControls(true);
        this.snackBar.open('Datei erfolgreich importiert.', 'OK', {
          duration: 5000
        });
      };
    } else {
      this.initTeamsFormControls();
      this.initQuestionsFormControls();
      this.snackBar.open('Konfiguration zurueckgesetzt.', 'OK', {
        duration: 5000
      });
    }
  }

  // TODO: implement it in a correct way, this is just because of the haste
  public toggleShowAnswers(cb: MatCheckbox, fgn: string): void {
    const showAnswers = !cb.checked; // it shows the state before the click, so we need to invert it
    this.applyShowAnswersState(fgn, showAnswers);
  }


  private applyShowAnswersState(fgn: string, showAnswers: boolean): void {
    const fgq = this.questionsFormGroup.get(fgn);
    const fga = fgq.get('answers');
    let text = 'bla';
    if (showAnswers) {
      text = '';
      fga.get(this.ANSWER_FORM_GROUP_BASE_NAME + '0').enable();
      fga.get(this.ANSWER_FORM_GROUP_BASE_NAME + '1').enable();
      fga.get(this.ANSWER_FORM_GROUP_BASE_NAME + '2').enable();
      fga.get(this.ANSWER_FORM_GROUP_BASE_NAME + '3').enable();
    } else {
      fga.get(this.ANSWER_FORM_GROUP_BASE_NAME + '0').disable();
      fga.get(this.ANSWER_FORM_GROUP_BASE_NAME + '1').disable();
      fga.get(this.ANSWER_FORM_GROUP_BASE_NAME + '2').disable();
      fga.get(this.ANSWER_FORM_GROUP_BASE_NAME + '3').disable();
    }
    fga.get(this.ANSWER_FORM_GROUP_BASE_NAME + '0').get('text').setValue(text);
    fga.get(this.ANSWER_FORM_GROUP_BASE_NAME + '0').get('isCorrect').setValue(!showAnswers);

    fga.get(this.ANSWER_FORM_GROUP_BASE_NAME + '1').get('text').setValue(text);
    fga.get(this.ANSWER_FORM_GROUP_BASE_NAME + '1').get('isCorrect').setValue(!showAnswers);

    fga.get(this.ANSWER_FORM_GROUP_BASE_NAME + '2').get('text').setValue(text);
    fga.get(this.ANSWER_FORM_GROUP_BASE_NAME + '2').get('isCorrect').setValue(!showAnswers);

    fga.get(this.ANSWER_FORM_GROUP_BASE_NAME + '3').get('text').setValue(text);
    fga.get(this.ANSWER_FORM_GROUP_BASE_NAME + '3').get('isCorrect').setValue(!showAnswers);
  }

  setStep(index: number): void {
    this.step = index;
  }

  changeMediaSelection(event: { path: string; question: number }): void {
    const prefix = 'http://' +
      ConfigService.get().server.address + ':' +
      ConfigService.get().fileServer.port +
      ConfigService.get().fileServer.publicPath;
    const mediaSrcControl = this.questionsFormGroup.controls['question' + event.question].get('mediaSrc');
    if (event && event.path) {
      mediaSrcControl.setValue(prefix + event.path);
    } else {
      mediaSrcControl.setValue('');
    }
  }

}
