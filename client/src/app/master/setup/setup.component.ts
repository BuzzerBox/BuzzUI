import {Component, OnInit, ViewChild} from '@angular/core';
import {Router} from '@angular/router';
import {CdkDragDrop, moveItemInArray} from '@angular/cdk/drag-drop';
import {AbstractControl, UntypedFormControl, UntypedFormGroup, ValidationErrors, ValidatorFn, Validators} from '@angular/forms';
import {GameService} from '../../services/game.service';
import {MatStepper} from '@angular/material/stepper';
import {IQuestion, IAnswer, IMediaQuestionState, IStorageLocation, StorageApiHelper} from '../../../../../shared/shared';
import {MatSnackBar} from '@angular/material/snack-bar';
import {IMediaSelection} from '../interfaces/IMediaSelection';
import {DEFAULT_MEDIA_QUESTION_CONFIG} from '../media-question-display-order-configuration/media-question-display-order-configuration.component';
import {IGameRef, StorageService} from '../../services/storage.service';
import {IEditorNavigationState, INewGameNavigationState, IPrepareNavigationState} from '../game-navigation';
import {baseUrlMaster, pathsMaster} from '../paths-master';

/**
 * The editor of a game: its name and where it is stored, and its questions. Saving adds a new version of the game;
 * the teams are chosen when it is played.
 */
@Component({
    selector: 'app-setup',
    templateUrl: './setup.component.html',
    styleUrls: ['./setup.component.css'],
    standalone: false
})
export class SetupComponent implements OnInit {
  public readonly ANSWER_FORM_GROUP_BASE_NAME = 'answer';

  @ViewChild('questionForm') questionForm;
  @ViewChild(MatStepper) stepper: MatStepper;
  // the editor is opened from the game manager, which it goes back to
  public readonly managerUrl = '/' + baseUrlMaster + pathsMaster.storage;

  // the game that is edited; null until a new game was created
  public ref: IGameRef = null;
  // the version the questions were loaded from, null for a new game
  public loadedVersion: number = null;
  // to tell when an older version is the base
  public latestVersion: number = null;
  public loading = false;
  public loadError: string = null;
  // for a new game
  public newGameName = new UntypedFormControl('', Validators.required);
  public newGameLocation: IStorageLocation = null;
  public createError: string = null;
  public creating = false;
  // after saving
  public savedVersion: number = null;
  public saving = false;
  public saveError: string = null;

  public questionsFormGroup: UntypedFormGroup;
  public questionFormGroupNames: string[];
  public questionInitialConfig: IMediaQuestionState[];

  step = 0;

  private readonly navigation: IEditorNavigationState | null;
  // where a new game goes first, the location chosen in the game manager
  public readonly newGameLocationId: string | null;

  constructor(private game: GameService, private storage: StorageService, private snackBar: MatSnackBar, private router: Router) {
    game.useAsMaster();
    this.navigation = (history.state as IEditorNavigationState)?.gameName ? history.state : null;
    this.newGameLocationId = (history.state as INewGameNavigationState)?.newGameLocationId ?? null;
  }

  async ngOnInit(): Promise<void> {
    this.initQuestionsFormControls();
    if (this.navigation != null) {
      await this.loadGame(this.navigation);
    }
  }

  public isNewGame(): boolean {
    return this.navigation == null;
  }

  private async loadGame(navigation: IEditorNavigationState): Promise<void> {
    this.loading = true;
    try {
      const location = await this.storage.getLocation(navigation.locationId);
      if (location == null) {
        throw new Error('Der Speicherort ist nicht mehr da. Wurde der USB-Stick abgezogen?');
      }
      const ref: IGameRef = {location, gameName: navigation.gameName};
      const info = await this.storage.getGame(ref);
      if (info == null) {
        throw new Error(`Das Spiel ${navigation.gameName} gibt es nicht mehr.`);
      }
      const baseVersion = navigation.baseVersion ?? info.latestVersion;
      if (baseVersion != null) {
        if (!info.versions.some(version => version.version === baseVersion)) {
          throw new Error(`Version ${baseVersion} von ${navigation.gameName} gibt es nicht mehr.`);
        }
        const definition = await this.storage.getVersion(ref, baseVersion);
        this.loadedVersion = definition.version;
        this.latestVersion = info.latestVersion;
        this.initQuestionsFormControls(definition.questions);
      }
      this.ref = ref;
      // continue with the questions
      setTimeout(() => this.stepper?.next());
    } catch (e) {
      this.loadError = StorageService.getErrorMessage(e);
    } finally {
      this.loading = false;
    }
  }

  public getSanitizedNewGameName(): string {
    return StorageApiHelper.sanitizeName(this.newGameName.value ?? '');
  }

  /**
   * Creates the folder of a new game, so media can be added to it right away
   */
  public async createGame(): Promise<void> {
    const name = this.getSanitizedNewGameName();
    if (!name || this.newGameLocation == null || this.creating) {
      return;
    }
    this.creating = true;
    this.createError = null;
    const ref: IGameRef = {location: this.newGameLocation, gameName: name};
    try {
      await this.storage.createGame(ref);
      this.ref = ref;
      this.newGameName.disable();
      setTimeout(() => this.stepper?.next());
    } catch (e) {
      this.createError = StorageService.isConflict(e)
        ? `Auf ${this.getLocationText(this.newGameLocation)} gibt es schon ein Spiel „${name}“. Wähle einen anderen Namen oder bearbeite es in der Spielverwaltung.`
        : StorageService.getErrorMessage(e);
    } finally {
      this.creating = false;
    }
  }

  public getLocationText(location: IStorageLocation): string {
    return location.type === 'box' ? 'der BuzzerBox' : 'dem USB-Stick ' + location.name;
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
      this.step = index;
    });
  }

  public dropQuestion(event: CdkDragDrop<string[]>): void {
    if (event.previousIndex === event.currentIndex) {
      return;
    }
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
      // relative to the game's media folder
      mediaSrc: new UntypedFormControl(''),
      // only for slideshows: the images, mediaSrc is then the folder
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

  /**
   * Saves the questions as a new version of the game, if they changed
   */
  public async saveGame(): Promise<void> {
    if (this.ref == null || this.saving) {
      return;
    }
    this.saving = true;
    this.saveError = null;
    try {
      const result = await this.storage.saveVersion(this.ref, this.buildSetupQuestionsObject());
      this.savedVersion = result.version;
      this.loadedVersion = result.version;
      this.snackBar.open(result.unchanged ? `Nichts geändert, es bleibt bei Version ${result.version}.` : `Version ${result.version} wurde gespeichert.`,
        'OK', {duration: 4000});
    } catch (e) {
      this.saveError = StorageService.getErrorMessage(e);
    } finally {
      this.saving = false;
    }
  }

  /**
   * Plays the saved version, choosing the teams first
   */
  public playSavedVersion(): void {
    const state: IPrepareNavigationState = {locationId: this.ref.location.id, gameName: this.ref.gameName, gameVersion: this.savedVersion};
    this.router.navigate([baseUrlMaster + pathsMaster.prepare], {state});
  }

  public onQuestionsChanged(): void {
    // the saved version no longer is what is shown
    this.savedVersion = null;
  }

  public getGameName(): string {
    return this.game.getGameName();
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
      questionFormGroup.get('mediaSrc').setValue(selection.path);
      questionFormGroup.get('slides').setValue(selection.slides ?? null);
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
