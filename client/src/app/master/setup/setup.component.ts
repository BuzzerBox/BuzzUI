import {Component, OnInit, ViewChild} from '@angular/core';
import {Router} from '@angular/router';
import {CdkDragDrop, moveItemInArray} from '@angular/cdk/drag-drop';
import {AbstractControl, UntypedFormControl, UntypedFormGroup, ValidationErrors, ValidatorFn, Validators} from '@angular/forms';
import {GameService} from '../../services/game.service';
import {MatStepper} from '@angular/material/stepper';
import {
  GameFormatHelper,
  IAnswer,
  IMediaQuestionDefaults,
  IMediaQuestionState,
  IQuestion,
  IRound,
  IStorageLocation,
  MediaHelper,
  StorageApiHelper,
  TMediaKind,
  TRoundMode
} from '../../../../../shared/shared';
import * as Uuid from 'uuid';
import {MatSnackBar} from '@angular/material/snack-bar';
import {IMediaSelection} from '../interfaces/IMediaSelection';
import {IGameRef, StorageService} from '../../services/storage.service';
import {IEditorNavigationState, INewGameNavigationState, IPrepareNavigationState} from '../game-navigation';
import {baseUrlMaster, pathsMaster} from '../paths-master';

/**
 * What the editor knows of a round: its settings, and the form of its questions. A Jeopardy round has its tiles in the
 * form category by category: the question of category c and value v is number c * values.length + v. A final has its
 * one question in the form.
 */
interface IRoundEditor {
  id: string;
  mode: TRoundMode;
  name: string;
  // Jeopardy only
  values: number[];
  categoryNames: string[];
  // the questions of the tiles that are a Daily Double, by their IDs
  dailyDoubleIds: string[];
  // the final only
  category: string;
  questionsFormGroup: UntypedFormGroup;
  questionFormGroupNames: string[];
  questionInitialConfig: IMediaQuestionState[];
  step: number;
}

// the board of a new Jeopardy round
const NEW_BOARD_CATEGORIES = 5;
const NEW_BOARD_VALUES = [100, 200, 300, 400, 500];

/**
 * The editor of a game: its name and where it is stored, and its rounds with their questions. Saving adds a new version
 * of the game; the teams are chosen when it is played. The questions form (questionsFormGroup and the fields next to
 * it) is the one of the round that is shown; the others wait in roundEditors.
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

  public roundEditors: IRoundEditor[] = [];
  public activeRoundIndex = 0;
  public readonly roundModes: TRoundMode[] = ['classic', 'jeopardy', 'final'];
  public readonly roundModeLabels: Record<TRoundMode, string> = {classic: 'Klassisch', jeopardy: 'Jeopardy', final: 'Finale'};
  public readonly roundModeIcons: Record<TRoundMode, string> = {classic: 'format_list_numbered', jeopardy: 'grid_view', final: 'emoji_events'};

  public questionsFormGroup: UntypedFormGroup;
  public questionFormGroupNames: string[];
  // a question's own config, undefined for the questions that start as the game's media defaults say
  public questionInitialConfig: IMediaQuestionState[];
  // how the media questions of the game start, for each kind of media
  public mediaDefaults: IMediaQuestionDefaults = MediaHelper.completeMediaDefaults(undefined);
  public readonly mediaKinds = MediaHelper.MEDIA_KINDS;
  public readonly mediaKindLabels: Record<TMediaKind, string> = {image: 'Bild', playable: 'Video & Audio', slideshow: 'Diashow'};
  public readonly mediaKindIcons: Record<TMediaKind, string> = {image: 'image', playable: 'movie', slideshow: 'burst_mode'};
  public readonly answerIndexes = [0, 1, 2, 3];

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
    this.initRoundEditors([]);
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
        this.initMediaDefaults(GameFormatHelper.getAllQuestions(definition.rounds), definition.mediaDefaults);
        this.initRoundEditors(definition.rounds);
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

  /**
   * Versions saved before games had media defaults have a config in every media question. Those that are the same as
   * the built-in default start following the game's defaults; the others stay their own.
   */
  private initMediaDefaults(questions: IQuestion[], mediaDefaults: Partial<IMediaQuestionDefaults> | undefined): void {
    this.mediaDefaults = MediaHelper.completeMediaDefaults(mediaDefaults);
    if (mediaDefaults != null) {
      return;
    }
    const builtIn = MediaHelper.getDefaultInitialConfig();
    questions.forEach(question => {
      if (MediaHelper.isSameInitialConfig(question.initialConfig, builtIn)) {
        delete question.initialConfig;
      }
    });
  }

  // ---- rounds ----

  /**
   * One editor for each round; a new game starts with a classic round
   */
  private initRoundEditors(rounds: IRound[]): void {
    this.roundEditors = [];
    const list = rounds.length > 0 ? rounds : [GameFormatHelper.makeClassicRound(Uuid.v4(), GameFormatHelper.makeRoundName(0), [])];
    for (const round of list) {
      if (round.mode === 'jeopardy') {
        this.initQuestionsFormControls(GameFormatHelper.getAllQuestions([round]), false);
        this.roundEditors.push(this.captureRoundEditor(round.id, round.mode, round.name, {
          values: [...round.values],
          categoryNames: round.categories.map(c => c.name),
          dailyDoubleIds: [...(round.dailyDoubleQuestionIds ?? [])]
        }));
      } else if (round.mode === 'final') {
        this.initQuestionsFormControls([round.question], false);
        this.roundEditors.push(this.captureRoundEditor(round.id, round.mode, round.name, {category: round.category}));
      } else {
        this.initQuestionsFormControls(round.questions);
        this.roundEditors.push(this.captureRoundEditor(round.id, round.mode, round.name));
      }
    }
    this.activeRoundIndex = 0;
    this.loadRoundEditor(this.roundEditors[0]);
  }

  /**
   * An editor for the questions form as it is now
   */
  private captureRoundEditor(id: string, mode: TRoundMode, name: string,
                             settings: Partial<Pick<IRoundEditor, 'values' | 'categoryNames' | 'dailyDoubleIds' | 'category'>> = {}): IRoundEditor {
    return {
      id, mode, name,
      values: settings.values ?? [],
      categoryNames: settings.categoryNames ?? [],
      dailyDoubleIds: settings.dailyDoubleIds ?? [],
      category: settings.category ?? '',
      questionsFormGroup: this.questionsFormGroup,
      questionFormGroupNames: this.questionFormGroupNames,
      questionInitialConfig: this.questionInitialConfig,
      step: this.step
    };
  }

  /**
   * Keeps the questions form of the round that is shown in its editor, before another one is shown or the rounds are saved
   */
  private storeActiveRoundEditor(): void {
    const editor = this.roundEditors[this.activeRoundIndex];
    if (editor) {
      editor.questionsFormGroup = this.questionsFormGroup;
      editor.questionFormGroupNames = this.questionFormGroupNames;
      editor.questionInitialConfig = this.questionInitialConfig;
      editor.step = this.step;
    }
  }

  private loadRoundEditor(editor: IRoundEditor): void {
    this.questionsFormGroup = editor.questionsFormGroup;
    this.questionFormGroupNames = editor.questionFormGroupNames;
    this.questionInitialConfig = editor.questionInitialConfig;
    this.step = editor.step;
  }

  public getActiveRoundEditor(): IRoundEditor {
    return this.roundEditors[this.activeRoundIndex];
  }

  /**
   * Jeopardy tiles are worth their value, and the final the wagers, rather than points of the question
   */
  public hidesQuestionPoints(): boolean {
    return this.getActiveRoundEditor()?.mode !== 'classic';
  }

  public showRound(index: number): void {
    if (index === this.activeRoundIndex) {
      return;
    }
    this.storeActiveRoundEditor();
    this.activeRoundIndex = index;
    this.loadRoundEditor(this.roundEditors[index]);
  }

  public addRound(mode: TRoundMode): void {
    this.storeActiveRoundEditor();
    const name = GameFormatHelper.makeRoundName(this.roundEditors.length);
    let editor: IRoundEditor;
    if (mode === 'jeopardy') {
      this.initQuestionsFormControls([], false);
      for (let i = 0; i < NEW_BOARD_CATEGORIES * NEW_BOARD_VALUES.length; i++) {
        this.appendQuestionFormGroup(this.createJeopardyQuestionFormGroup());
      }
      const categoryNames = Array.from({length: NEW_BOARD_CATEGORIES}, (_, i) => `Kategorie ${i + 1}`);
      editor = this.captureRoundEditor(Uuid.v4(), mode, name, {values: [...NEW_BOARD_VALUES], categoryNames});
    } else if (mode === 'final') {
      this.initQuestionsFormControls([], false);
      // like a tile: the master grades it, answer options are optional
      this.appendQuestionFormGroup(this.createJeopardyQuestionFormGroup());
      editor = this.captureRoundEditor(Uuid.v4(), mode, 'Finale');
    } else {
      this.initQuestionsFormControls([]);
      editor = this.captureRoundEditor(Uuid.v4(), mode, name);
    }
    this.roundEditors = [...this.roundEditors, editor];
    this.activeRoundIndex = this.roundEditors.length - 1;
    this.setStep(0);
    this.onQuestionsChanged();
  }

  public removeRound(index: number): void {
    if (this.roundEditors.length < 2) {
      return;
    }
    this.storeActiveRoundEditor();
    const removed = this.roundEditors[index];
    this.roundEditors = this.roundEditors.filter((_, i) => i !== index);
    this.activeRoundIndex = Math.min(index, this.roundEditors.length - 1);
    this.loadRoundEditor(this.roundEditors[this.activeRoundIndex]);
    this.onQuestionsChanged();
    const snackBarRef = this.snackBar.open(`${removed.name} gelöscht`, 'Rückgängig', {duration: 5000});
    snackBarRef.onAction().subscribe(() => {
      this.storeActiveRoundEditor();
      this.roundEditors = [...this.roundEditors.slice(0, index), removed, ...this.roundEditors.slice(index)];
      this.activeRoundIndex = index;
      this.loadRoundEditor(removed);
      this.onQuestionsChanged();
    });
  }

  /**
   * Moves the round that is shown one place earlier (-1) or later (1)
   */
  public moveRound(delta: number): void {
    const target = this.activeRoundIndex + delta;
    if (target < 0 || target >= this.roundEditors.length) {
      return;
    }
    const editors = [...this.roundEditors];
    [editors[this.activeRoundIndex], editors[target]] = [editors[target], editors[this.activeRoundIndex]];
    this.roundEditors = editors;
    this.activeRoundIndex = target;
    this.onQuestionsChanged();
  }

  private getEditorForm(index: number): {group: UntypedFormGroup, names: string[]} {
    const editor = this.roundEditors[index];
    return index === this.activeRoundIndex
      ? {group: this.questionsFormGroup, names: this.questionFormGroupNames}
      : {group: editor.questionsFormGroup, names: editor.questionFormGroupNames};
  }

  /**
   * Whether the round can be saved: its questions are complete, and a board has named categories and whole values
   */
  public isRoundValid(index: number): boolean {
    const editor = this.roundEditors[index];
    const form = this.getEditorForm(index);
    if (!editor || !form.group.valid || (editor.name ?? '').trim() === '') {
      return false;
    }
    if (editor.mode === 'final') {
      return (editor.category ?? '').trim() !== '' && form.names.length === 1;
    }
    if (editor.mode === 'jeopardy') {
      return editor.values.length > 0 && editor.categoryNames.length > 0
        && editor.values.every(value => Number.isInteger(value) && value >= 1)
        && editor.categoryNames.every(name => (name ?? '').trim() !== '');
    }
    return form.names.length > 0;
  }

  public areAllRoundsValid(): boolean {
    return this.roundEditors.length > 0 && this.roundEditors.every((_, i) => this.isRoundValid(i));
  }

  // ---- the Jeopardy board of the round that is shown ----

  public getTileIndex(categoryIndex: number, valueIndex: number): number {
    return categoryIndex * this.getActiveRoundEditor().values.length + valueIndex;
  }

  /**
   * E.g. "Geografie · 300" for the selected tile
   */
  public getTileTitle(index: number): string {
    const editor = this.getActiveRoundEditor();
    const valueCount = editor.values.length;
    if (valueCount === 0) {
      return '';
    }
    const categoryName = (editor.categoryNames[Math.floor(index / valueCount)] ?? '').trim() || 'Kategorie';
    return `${categoryName} · ${editor.values[index % valueCount]}`;
  }

  public addCategory(): void {
    const editor = this.getActiveRoundEditor();
    editor.categoryNames = [...editor.categoryNames, `Kategorie ${editor.categoryNames.length + 1}`];
    // the new category's tiles come last, as its questions do in the form
    editor.values.forEach(() => this.appendQuestionFormGroup(this.createJeopardyQuestionFormGroup()));
    this.setStep(this.getTileIndex(editor.categoryNames.length - 1, 0));
    this.onQuestionsChanged();
  }

  public removeCategory(categoryIndex: number): void {
    const editor = this.getActiveRoundEditor();
    const valueCount = editor.values.length;
    this.rearrangeQuestions(this.getQuestionEntries().filter((_, i) => Math.floor(i / valueCount) !== categoryIndex));
    editor.categoryNames = editor.categoryNames.filter((_, i) => i !== categoryIndex);
    this.setStep(0);
    this.onQuestionsChanged();
  }

  /**
   * A new row at the bottom of the board, worth as much more as the row above is worth more than the one before
   */
  public addValue(): void {
    const editor = this.getActiveRoundEditor();
    const valueCount = editor.values.length;
    const last = editor.values[valueCount - 1];
    const step = valueCount > 1 ? last - editor.values[valueCount - 2] : 100;
    const entries = this.getQuestionEntries();
    const rearranged: ({group: UntypedFormGroup, config: IMediaQuestionState} | null)[] = [];
    editor.categoryNames.forEach((_, c) => rearranged.push(...entries.slice(c * valueCount, (c + 1) * valueCount), null));
    this.rearrangeQuestions(rearranged);
    editor.values = [...editor.values, valueCount > 0 ? last + (step > 0 ? step : 100) : 100];
    this.setStep(this.getTileIndex(0, valueCount));
    this.onQuestionsChanged();
  }

  public removeValue(valueIndex: number): void {
    const editor = this.getActiveRoundEditor();
    const valueCount = editor.values.length;
    this.rearrangeQuestions(this.getQuestionEntries().filter((_, i) => i % valueCount !== valueIndex));
    editor.values = editor.values.filter((_, i) => i !== valueIndex);
    this.setStep(0);
    this.onQuestionsChanged();
  }

  public setBoardValue(valueIndex: number, value: unknown): void {
    const editor = this.getActiveRoundEditor();
    editor.values = editor.values.map((v, i) => i === valueIndex ? Number(value) : v);
    this.onQuestionsChanged();
  }

  public setCategoryName(categoryIndex: number, name: string): void {
    const editor = this.getActiveRoundEditor();
    editor.categoryNames = editor.categoryNames.map((n, i) => i === categoryIndex ? name : n);
    this.onQuestionsChanged();
  }

  private getQuestionId(index: number): string | undefined {
    return this.questionsFormGroup.get(this.questionFormGroupNames[index])?.get('id').value;
  }

  public isDailyDouble(index: number): boolean {
    const id = this.getQuestionId(index);
    return id != null && this.getActiveRoundEditor().dailyDoubleIds.includes(id);
  }

  /**
   * Makes the tile a Daily Double, or a tile like the others again
   */
  public setDailyDouble(index: number, isDailyDouble: boolean): void {
    const editor = this.getActiveRoundEditor();
    const id = this.getQuestionId(index);
    if (id == null) {
      return;
    }
    editor.dailyDoubleIds = isDailyDouble ? [...editor.dailyDoubleIds.filter(i => i !== id), id] : editor.dailyDoubleIds.filter(i => i !== id);
    this.onQuestionsChanged();
  }

  public isTileValid(index: number): boolean {
    return !!this.questionsFormGroup.get(this.questionFormGroupNames[index])?.valid;
  }

  private getQuestionEntries(): {group: UntypedFormGroup, config: IMediaQuestionState}[] {
    return this.questionFormGroupNames.map((name, i) => ({
      group: this.questionsFormGroup.get(name) as UntypedFormGroup,
      config: this.questionInitialConfig[i]
    }));
  }

  /**
   * Puts the questions of the round that is shown in a new order; null makes a new tile
   */
  private rearrangeQuestions(entries: ({group: UntypedFormGroup, config: IMediaQuestionState} | null)[]): void {
    const newGroup = new UntypedFormGroup({});
    const names: string[] = [];
    const configs: IMediaQuestionState[] = [];
    entries.forEach((entry, i) => {
      const name = 'question' + i;
      names.push(name);
      configs.push(entry?.config);
      newGroup.addControl(name, entry?.group ?? this.createJeopardyQuestionFormGroup());
    });
    this.questionsFormGroup = newGroup;
    this.questionFormGroupNames = names;
    this.questionInitialConfig = configs;
  }

  /**
   * A tile's question: the master grades it, answer options are optional and start turned off
   */
  private createJeopardyQuestionFormGroup(): UntypedFormGroup {
    const group = this.createQuestionFormGroup();
    group.get('answersVisible').setValue(false);
    for (let i = 0; i < 4; i++) {
      group.get('answers').get(this.ANSWER_FORM_GROUP_BASE_NAME + i).disable();
    }
    return group;
  }

  // ---- questions ----

  /**
   * @param addIfEmpty a classic round gets its first question, a board starts empty
   */
  private initQuestionsFormControls(importedQuestions: IQuestion[] | null = null, addIfEmpty = true): void {
    this.questionsFormGroup = new UntypedFormGroup({});
    this.questionFormGroupNames = [];
    this.questionInitialConfig = [];
    this.step = 0;
    if (!importedQuestions?.length) {
      if (addIfEmpty) {
        this.addQuestionToFormGroup();
      }
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
        id: q.id,
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
    this.appendQuestionFormGroup(this.createQuestionFormGroup());
    this.setStep(this.questionFormGroupNames.length - 1);
  }

  private appendQuestionFormGroup(group: UntypedFormGroup): void {
    const formGroupName: string = 'question' + this.questionFormGroupNames.length;
    this.questionFormGroupNames.push(formGroupName);
    this.questionInitialConfig.push(undefined);
    this.questionsFormGroup.addControl(formGroupName, group);
  }

  private createQuestionFormGroup(): UntypedFormGroup {
    return new UntypedFormGroup({
      // stays the same when the question is changed or moved, see IQuestion.id
      id: new UntypedFormControl(Uuid.v4()),
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
    return this.roundEditors.reduce((sum, _, i) => sum + this.getEditorForm(i).names.length, 0);
  }

  private buildQuestions(editor: IRoundEditor): IQuestion[] {
    const ret: IQuestion[] = [];
    editor.questionFormGroupNames.forEach((name, index) => {
      const questionFormGroup: UntypedFormGroup = editor.questionsFormGroup.get(name) as UntypedFormGroup;
      const questionText: string = (questionFormGroup.get('text').value ?? '').toString();
      const mediaSrc: string = (questionFormGroup.get('mediaSrc').value ?? '').toString();
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
        id: questionFormGroup.get('id').value,
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
        // only a question's own config is stored, the others start as the game's media defaults say
        if (editor.questionInitialConfig[index]) {
          question.initialConfig = editor.questionInitialConfig[index];
        }
      }
      ret.push(question);
    });
    return ret;
  }

  /**
   * The rounds of the game as they are saved
   */
  private buildRounds(): IRound[] {
    this.storeActiveRoundEditor();
    return this.roundEditors.map((editor, index) => {
      const name = editor.name.trim() || GameFormatHelper.makeRoundName(index);
      // a tile is worth its value and the final the wagers, not points of their own
      const questions = this.buildQuestions(editor).map(question => {
        if (editor.mode === 'classic') {
          return question;
        }
        const withoutPoints = {...question};
        delete withoutPoints.points;
        return withoutPoints;
      });
      if (editor.mode === 'final') {
        return GameFormatHelper.makeFinalRound(editor.id, name, editor.category.trim(), questions[0]);
      }
      if (editor.mode === 'jeopardy') {
        const valueCount = editor.values.length;
        const ids = new Set(questions.map(question => question.id));
        return GameFormatHelper.makeJeopardyRound(editor.id, name, [...editor.values], editor.categoryNames.map((categoryName, c) => ({
          name: categoryName.trim(),
          questions: questions.slice(c * valueCount, (c + 1) * valueCount)
        })), editor.dailyDoubleIds.filter(id => ids.has(id)));
      }
      return GameFormatHelper.makeClassicRound(editor.id, name, questions);
    });
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
      const result = await this.storage.saveVersion(this.ref, this.buildRounds(), this.mediaDefaults);
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
   * The points of the question for the panel header
   */
  public getPointsText(questionFormGroupName: string): string {
    const points = Number(this.questionsFormGroup.controls[questionFormGroupName]?.get('points').value);
    if (!Number.isFinite(points)) {
      return '';
    }
    return points === 1 ? '1 Punkt' : `${points} Punkte`;
  }

  /**
   * The start of the question text, so collapsed questions can be told apart
   */
  public getQuestionPreview(questionFormGroupName: string): string {
    const text = (this.questionsFormGroup.controls[questionFormGroupName]?.get('text').value ?? '').toString().replace(/\s+/g, ' ').trim();
    return text.length > 60 ? text.slice(0, 57) + '…' : text;
  }

  public isCorrectAnswer(questionFormGroupName: string, answerIndex: number): boolean {
    return !!this.getAnswerFromGroup(questionFormGroupName).get(this.ANSWER_FORM_GROUP_BASE_NAME + answerIndex)?.get('isCorrect').value;
  }

  /**
   * The kind of media the question shows, null if it has none
   */
  public getMediaKind(questionFormGroupName: string): TMediaKind | null {
    const questionFormGroup = this.questionsFormGroup.controls[questionFormGroupName];
    return MediaHelper.getMediaKind({
      fileSrc: (questionFormGroup.get('mediaSrc').value ?? '').toString(),
      slides: questionFormGroup.get('slides').value ?? undefined
    });
  }

  changeQuestionConfig(event: { config: IMediaQuestionState; question: number }): void {
    this.questionInitialConfig[event.question] = event.config;
    this.onQuestionsChanged();
  }

  changeMediaDefault(kind: TMediaKind, config: IMediaQuestionState): void {
    this.mediaDefaults = {...this.mediaDefaults, [kind]: config};
    this.onQuestionsChanged();
  }

  /**
   * Gives the question its own config, starting as the game's default for its media
   */
  public customizeQuestionConfig(index: number, kind: TMediaKind): void {
    this.questionInitialConfig[index] = {...this.mediaDefaults[kind]};
    this.onQuestionsChanged();
  }

  /**
   * Lets the question start as the game's media defaults say again
   */
  public resetQuestionConfig(index: number): void {
    this.questionInitialConfig[index] = undefined;
    this.onQuestionsChanged();
  }
}
