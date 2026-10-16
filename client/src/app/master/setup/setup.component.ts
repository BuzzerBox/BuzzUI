import {ChangeDetectorRef, Component, OnInit, ViewChild} from '@angular/core';
import {CdkDragDrop, moveItemInArray} from '@angular/cdk/drag-drop';
import {AbstractControl, UntypedFormControl, UntypedFormGroup, ValidationErrors, ValidatorFn, Validators} from '@angular/forms';
import {GameService, IGameStateAsJson} from '../../services/game.service';
import {MatCheckbox} from '@angular/material/checkbox';
import {ITeam, IQuestion, IAnswer, IGameState, IMediaQuestionState, PacketHelper} from '../../../../../shared/shared';
import {MatSnackBar} from '@angular/material/snack-bar';
import {IUploadFormData} from '../interfaces/IUploadFormData';
import {FileService} from '../../services/file.service';
import {IMediaSelection} from '../interfaces/IMediaSelection';
import {DEFAULT_MEDIA_QUESTION_CONFIG} from '../media-question-display-order-configuration/media-question-display-order-configuration.component';

@Component({
    selector: 'app-setup',
    templateUrl: './setup.component.html',
    styleUrls: ['./setup.component.css'],
    standalone: false
})
export class SetupComponent implements OnInit {
  public readonly FORM_GROUP_NAME_TEAMS = 'teamsFormGroup';
  public readonly ANSWER_FORM_GROUP_BASE_NAME = 'answer';

  @ViewChild('questionForm') questionForm;

  public teamsFormGroup: UntypedFormGroup;
  public questionsFormGroup: UntypedFormGroup;
  public teamNameSuggestions: string[];
  public teamFormControlNames: string[];
  public questionFormGroupNames: string[];
  private mapTeamFormControlNameToBuzzerIndex: Map<string, number>;
  // points of the teams of an imported savegame, by team form control name
  private importedPoints: Map<string, number>;
  // progress of an imported savegame; null for a new game
  private importedGameState: IGameState | null = null;
  public questionInitialConfig: IMediaQuestionState[];

  step = 0;


  constructor(private game: GameService, private cd: ChangeDetectorRef, private snackBar: MatSnackBar) {
    game.useAsMaster();
  }

  ngOnInit(): void {
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

  /**
   * Offers one team per available buzzer. With imported teams, each one is put on its buzzer and buzzers without a
   * team are deactivated.
   */
  private initTeamsFormControls(importedTeams: ITeam[] | null = null): void {
    this.teamFormControlNames = [];
    this.teamNameSuggestions = [];
    this.mapTeamFormControlNameToBuzzerIndex = new Map<string, number>();
    this.importedPoints = new Map<string, number>();
    const teamFormControls: {
      [key: string]: AbstractControl;
    } = {};
    const availableBuzzers = this.game.getPresetupData().availableBuzzers;
    for (let i = 0; i < availableBuzzers.length; i++) {
      const teamNameSuggestion = 'Team ' + (i + 1);
      this.teamNameSuggestions.push(teamNameSuggestion);
      const formControlName = 'team' + (i + 1);
      this.teamFormControlNames.push(formControlName);
      this.mapTeamFormControlNameToBuzzerIndex.set(formControlName, i);
      const formControlForTeam = new UntypedFormControl(teamNameSuggestion);
      if (importedTeams != null) {
        const importedTeam = importedTeams.find(team => team.buzzerIndex === i);
        if (importedTeam != null) {
          formControlForTeam.setValue(importedTeam.name);
          this.importedPoints.set(formControlName, importedTeam.points ?? 0);
        } else if (i >= 2) {
          // since two teams are mandatory, only all up from the third one can be deactivated
          formControlForTeam.disable();
        }
      }
      teamFormControls[formControlName] = formControlForTeam;
    }
    this.teamsFormGroup = new UntypedFormGroup(teamFormControls);
  }

  private initQuestionsFormControls(importedQuestions: IQuestion[] | null = null): void {
    this.questionsFormGroup = new UntypedFormGroup({});
    this.questionFormGroupNames = [];
    this.questionInitialConfig = [];
    if (!importedQuestions?.length) {
      this.addQuestionToFormGroup();
      return;
    }
    importedQuestions.forEach((q, i) => {
      const fgn = 'question' + i;
      this.questionFormGroupNames.push(fgn);
      this.questionInitialConfig.push(q.initialConfig);

      const showAnswers = !!q.show;
      // setups saved before answers were kept filled answers of questions without answer options with placeholders
      const answers: IAnswer[] = (q.answers ?? []).map(a => !showAnswers && a.text === 'bla' && a.isCorrect ? {text: '', isCorrect: false} : a);
      const answersValue: Record<string, IAnswer> = {};
      answers.slice(0, 4).forEach((a, j) => answersValue[this.ANSWER_FORM_GROUP_BASE_NAME + j] = {text: a.text, isCorrect: !!a.isCorrect});

      // built like a new question so the imported one gets the same validators
      const questionFormGroup = this.createQuestionFormGroup();
      questionFormGroup.patchValue({
        text: q.text,
        mediaSrc: q.mediaDetails?.fileSrc ?? '',
        slides: q.mediaDetails?.slides ?? null,
        answers: answersValue,
        answersVisible: showAnswers,
        notes: q.notes ?? '',
        points: GameService.getQuestionPoints(q)
      });
      this.questionsFormGroup.setControl(fgn, questionFormGroup);
      if (!showAnswers) {
        this.applyShowAnswersState(fgn, false);
      }
    });
    this.setStep(0);
  }

  public removeQuestion(index: number, event: MouseEvent): void {
    event.stopPropagation();
    const deletedControl = this.questionsFormGroup.get(this.questionFormGroupNames[index]) as UntypedFormGroup;
    const deletedInitialConfig = this.questionInitialConfig[index];
    const gameStateBeforeDeletion = this.importedGameState;
    this.remapImportedQuestionNumber(oldIndex => oldIndex === index ? null : oldIndex < index ? oldIndex : oldIndex - 1);
    this.questionInitialConfig = this.questionInitialConfig.filter((_, i) => i !== index);
    const remainingNames = this.questionFormGroupNames.filter((_, i) => i !== index);
    const newGroup = new UntypedFormGroup({});
    const newNames: string[] = [];
    for (let i = 0; i < remainingNames.length; i++) {
      const newName = 'question' + i;
      newNames.push(newName);
      newGroup.addControl(newName, this.questionsFormGroup.get(remainingNames[i]) as UntypedFormGroup);
    }
    this.questionFormGroupNames = newNames;
    this.questionsFormGroup = newGroup;
    if (index < this.step) {
      this.step--;
    }
    if (this.step >= this.questionFormGroupNames.length) {
      this.step = Math.max(0, this.questionFormGroupNames.length - 1);
    }

    const snackBarRef = this.snackBar.open(`Frage ${index + 1} gelöscht`, 'Rückgängig', { duration: 5000 });
    snackBarRef.onAction().subscribe(() => {
      const restoredNames: string[] = [];
      const restoredGroup = new UntypedFormGroup({});
      for (let i = 0; i < index; i++) {
        const name = 'question' + i;
        restoredNames.push(name);
        restoredGroup.addControl(name, this.questionsFormGroup.get(this.questionFormGroupNames[i]) as UntypedFormGroup);
      }
      restoredNames.push('question' + index);
      restoredGroup.addControl('question' + index, deletedControl);
      for (let i = index; i < this.questionFormGroupNames.length; i++) {
        const name = 'question' + (i + 1);
        restoredNames.push(name);
        restoredGroup.addControl(name, this.questionsFormGroup.get(this.questionFormGroupNames[i]) as UntypedFormGroup);
      }
      this.questionFormGroupNames = restoredNames;
      this.questionsFormGroup = restoredGroup;
      this.questionInitialConfig = [
        ...this.questionInitialConfig.slice(0, index),
        deletedInitialConfig,
        ...this.questionInitialConfig.slice(index)
      ];
      this.importedGameState = gameStateBeforeDeletion;
      this.step = index;
    });
  }

  public dropQuestion(event: CdkDragDrop<string[]>): void {
    if (event.previousIndex === event.currentIndex) {
      return;
    }
    const newOrderOfOldIndices = this.questionFormGroupNames.map((_, i) => i);
    moveItemInArray(newOrderOfOldIndices, event.previousIndex, event.currentIndex);
    this.remapImportedQuestionNumber(oldIndex => newOrderOfOldIndices.indexOf(oldIndex));
    moveItemInArray(this.questionFormGroupNames, event.previousIndex, event.currentIndex);
    moveItemInArray(this.questionInitialConfig, event.previousIndex, event.currentIndex);
    const newGroup = new UntypedFormGroup({});
    const newNames: string[] = [];
    for (let i = 0; i < this.questionFormGroupNames.length; i++) {
      const newName = 'question' + i;
      const control = this.questionsFormGroup.get(this.questionFormGroupNames[i]) as UntypedFormGroup;
      newNames.push(newName);
      newGroup.addControl(newName, control);
    }
    this.questionFormGroupNames = newNames;
    this.questionsFormGroup = newGroup;
    this.step = event.currentIndex;
  }

  /**
   * An imported game refers to its current question by position, so it has to follow when questions are deleted or
   * moved. If the current question itself is deleted, the game continues with the one that takes its place.
   * @param newIndexOf maps a question's old position to its new one, or to null if it was deleted
   */
  private remapImportedQuestionNumber(newIndexOf: (oldIndex: number) => number | null): void {
    if (this.importedGameState == null) {
      return;
    }
    const newIndex = newIndexOf(this.importedGameState.currentQuestionNumber);
    if (newIndex != null) {
      this.importedGameState = {...this.importedGameState, currentQuestionNumber: newIndex};
    } else {
      // answers, marked teams and media state belonged to the deleted question
      this.importedGameState = {
        ...this.importedGameState,
        loggedAnswers: [],
        activatedAnswers: [],
        markedTeamIds: [],
        setBuzzerLock: false,
        mediaQuestionState: PacketHelper.getDefaultMediaState()
      };
    }
  }

  public addQuestionToFormGroup(): void {
    const qfc: UntypedFormGroup = this.createQuestionFormGroup();
    const formGroupName: string = 'question' + this.questionFormGroupNames.length;
    this.questionFormGroupNames.push(formGroupName);
    this.questionInitialConfig.push(undefined);
    this.questionsFormGroup.addControl(formGroupName, qfc);
    this.setStep(this.questionFormGroupNames.length - 1);
  }

  private createQuestionFormGroup(): UntypedFormGroup {
    return new UntypedFormGroup({
      text: new UntypedFormControl(null, Validators.required),
      mediaSrc: new UntypedFormControl(''),
      // only for slideshows: the image URLs, mediaSrc is then the folder
      slides: new UntypedFormControl(null),
      answers: new UntypedFormGroup({
        answer0: this.createFormGroupForAnswer(),
        answer1: this.createFormGroupForAnswer(),
        answer2: this.createFormGroupForAnswer(),
        answer3: this.createFormGroupForAnswer()
      }, {validators: this.atLeastOneCorrectAnswer()}),
      answersVisible: new UntypedFormControl(true),
      notes: new UntypedFormControl(''),
      // whole points, at least 1
      points: new UntypedFormControl(1, [Validators.required, Validators.min(1), Validators.pattern(/^\d+$/)])
    });
  }

  private createFormGroupForAnswer(): UntypedFormGroup {
    return new UntypedFormGroup({
      text: new UntypedFormControl(null, Validators.required),
      isCorrect: new UntypedFormControl(false)
    });
  }

  public getQuestionFormGroup(name: string): UntypedFormGroup {
    return this.questionsFormGroup.get(name) as UntypedFormGroup;
  }

  public getAnswerFromGroup(questionName: string): UntypedFormGroup {
    return this.getQuestionFormGroup(questionName).get('answers') as UntypedFormGroup;
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
    this.game.setupGame(teams, questions, this.getGameStateForSetup(questions.length));
  }

  /**
   * The progress of an imported game, kept inside the question list; undefined for a new game.
   */
  private getGameStateForSetup(numberOfQuestions: number): IGameState | undefined {
    if (this.importedGameState == null) {
      return undefined;
    }
    const lastQuestionNumber = Math.max(0, numberOfQuestions - 1);
    if (this.importedGameState.currentQuestionNumber > lastQuestionNumber) {
      return {...this.importedGameState, currentQuestionNumber: lastQuestionNumber};
    }
    return this.importedGameState;
  }

  private buildSetupTeamsObject(): ITeam[] {
    const ret: ITeam[] = [];
    for (const name of this.teamFormControlNames) {
      if (!this.teamsFormGroup.get(name).disabled) {
        const buzzerIndex = this.mapTeamFormControlNameToBuzzerIndex.get(name);
        const buzzerId = this.game.getPresetupData().availableBuzzers[buzzerIndex].id;
        const team: ITeam = {
          name: this.teamsFormGroup.get(name).value,
          buzzerId,
          teamId: buzzerId, // use the buzzerId for now
          buzzerIndex
        };
        if (this.importedPoints.has(name)) {
          team.points = this.importedPoints.get(name);
        }
        ret.push(team);
      }
    }
    return ret;
  }

  private buildSetupQuestionsObject(): IQuestion[] {
    const ret: IQuestion[] = [];
    this.questionFormGroupNames.forEach((name, index) => {
      const questionFormGroup: UntypedFormGroup = this.questionsFormGroup.get(name) as UntypedFormGroup;
      const questionText: string = questionFormGroup.get('text').value.toString();
      const mediaSrc: string = questionFormGroup.get('mediaSrc').value.toString();
      const answers: IAnswer[] = [];
      for (let i = 0; i < 4; i++) {
        const answerFormGroup: UntypedFormGroup = questionFormGroup.get('answers').get(this.ANSWER_FORM_GROUP_BASE_NAME + i) as UntypedFormGroup;
        answers.push({
          // answers of questions without answer options may never have been filled in
          text: (answerFormGroup.get('text').value ?? '').toString(),
          isCorrect: !!answerFormGroup.get('isCorrect').value
        });
      }
      const question: IQuestion = {
        text: questionText,
        answers,
        show: questionFormGroup.get('answersVisible').value as boolean
      };
      const points = Number(questionFormGroup.get('points').value);
      // the default of 1 point is left out, like in savegames from before points could be set
      if (points !== 1) {
        question.points = points;
      }
      const notes: string = (questionFormGroup.get('notes').value ?? '').toString().trim();
      if (notes) {
        question.notes = notes;
      }
      if (mediaSrc) {
        question.mediaDetails = {
          fileSrc: mediaSrc
        };
        const slides: string[] | null = questionFormGroup.get('slides').value;
        if (slides?.length) {
          question.mediaDetails.slides = slides;
        }
        // the config component only emits once the user changes something, so fall back to the default it shows
        question.initialConfig = this.questionInitialConfig[index] ?? {...DEFAULT_MEDIA_QUESTION_CONFIG};
      }
      ret.push(question);
    });
    return ret;
  }

  public downloadSetupAsJson(): void {
    const questions: IQuestion[] = this.buildSetupQuestionsObject();
    this.game.downloadGameStateAsJson('buzzer-game-setup.json', this.buildSetupTeamsObject(), questions,
      this.getGameStateForSetup(questions.length) ?? null);
  }

  public getGameName(): string {
    return this.game.getGameName();
  }

  public onSaveGameFileSelected(uploadEvent: IUploadFormData): void {
    if (uploadEvent.data) {
      this.snackBar.open('Datei wird importiert, bitte warten...');
      // if typed as File, the fileReader.readAsText complains
      const configFile: any = uploadEvent.data;
      const fileReader = new FileReader();
      fileReader.readAsText(configFile as Blob, 'UTF-8');
      fileReader.onload = async () => {
        try {
          const importedState: IGameStateAsJson = JSON.parse(fileReader.result as string);
          const numberOfSavedTeams = importedState.teams?.length ?? 0;
          await this.game.importGameStateFromJson(importedState, false);

          this.importedGameState = this.game.getGameStateData();
          this.initTeamsFormControls(this.game.getTeams());
          this.initQuestionsFormControls(this.game.getQuestions());
          const numberOfDroppedTeams = numberOfSavedTeams - this.game.getTeams().length;
          const message = numberOfDroppedTeams > 0
            ? `Datei importiert. ${numberOfDroppedTeams} Team(s) ohne passenden Buzzer wurden entfernt.`
            : 'Datei erfolgreich importiert.';
          this.snackBar.open(message, 'OK', {
            duration: 5000
          });
        } catch (e) {
          console.error(e);
          this.snackBar.open('Die Datei konnte nicht importiert werden.', 'OK', {
            duration: 5000
          });
        }
      };
    } else {
      this.importedGameState = null;
      this.initTeamsFormControls();
      this.initQuestionsFormControls();
      this.snackBar.open('Konfiguration zurückgesetzt.', 'OK', {
        duration: 5000
      });
    }
  }

  // TODO: implement it in a correct way, this is just because of the haste
  /**
   * Questions without answer options keep their answers in the form, disabled, so turning the option back on restores them.
   */
  public applyShowAnswersState(fgn: string, showAnswers: boolean): void {
    const fga = this.questionsFormGroup.get(fgn).get('answers');
    for (let i = 0; i < 4; i++) {
      const answer = fga.get(this.ANSWER_FORM_GROUP_BASE_NAME + i);
      if (showAnswers) {
        answer.enable();
      } else {
        answer.disable();
      }
    }
  }

  setStep(index: number): void {
    this.step = index;
  }

  changeMediaSelection(event: { selection: IMediaSelection; question: number }): void {
    const questionFormGroup = this.questionsFormGroup.controls['question' + event.question];
    const selection = event.selection;
    if (selection?.path) {
      questionFormGroup.get('mediaSrc').setValue(FileService.buildFullPathString(selection.path));
      questionFormGroup.get('slides').setValue(selection.slides?.map(path => FileService.buildFullPathString(path)) ?? null);
    } else {
      questionFormGroup.get('mediaSrc').setValue('');
      questionFormGroup.get('slides').setValue(null);
    }
  }

  /**
   * The points of the question if they differ from the default 1, for the panel header; otherwise null
   */
  public getCustomPoints(questionFormGroupName: string): number | null {
    const points = Number(this.questionsFormGroup.controls[questionFormGroupName]?.get('points').value);
    return Number.isFinite(points) && points !== 1 ? points : null;
  }

  public isSlideshow(questionFormGroupName: string): boolean {
    return !!this.questionsFormGroup.controls[questionFormGroupName].get('slides').value?.length;
  }

  changeQuestionConfig(event: { config: IMediaQuestionState; question: number }): void {
    this.questionInitialConfig[event.question] = event.config;
  }


}
