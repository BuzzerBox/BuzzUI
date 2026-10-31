import {Component, OnDestroy, OnInit} from '@angular/core';
import {Router} from '@angular/router';
import {Subscription} from 'rxjs';
import {UntypedFormControl, UntypedFormGroup, Validators} from '@angular/forms';
import {MatDialog} from '@angular/material/dialog';
import {
  BuzzerHelper,
  GameFormatHelper,
  IBuzzer,
  IDirectoryTree,
  IGameDefinition,
  IGameInstanceState,
  IGameState,
  IJeopardyRoundProgress,
  IPlayOptions,
  ITeam,
  MediaHelper,
  StorageApiHelper
} from '../../../../../shared/shared';
import {GameService} from '../../services/game.service';
import {TeamColorHelper} from '../../helper/team-color.helper';
import {TeamHelper} from '../../helper/team.helper';
import {IGameRef, StorageService} from '../../services/storage.service';
import {GameFileHelper} from '../../helper/game-file.helper';
import {IPrepareNavigationState} from '../game-navigation';
import {baseUrlMaster, pathsMaster} from '../paths-master';
import {DialogConfirmComponent, IDialogConfirmData} from '../dialog-confirm/dialog-confirm.component';
import {IScreenTheme, SCREEN_THEMES} from '../../themes/screen-themes';
import {ScreenThemeHelper} from '../../themes/screen-theme.helper';

interface ITeamRow {
  buzzer: IBuzzer;
  buzzerIndex: number;
  // the team of the continued state that is on this buzzer, if any
  team?: ITeam;
  controlName: string;
  // the name a new team on it started with, which follows the buzzer's color until it is changed by hand
  defaultName?: string;
}

interface IMissingMedia {
  roundNumber: number;
  questionNumber: number;
  path: string;
}

/**
 * Chooses the teams before a stored game is played, for a new state or one that is continued, and sets the game up
 */
@Component({
    selector: 'app-prepare-game',
    templateUrl: './prepare-game.component.html',
    styleUrls: ['./prepare-game.component.css'],
    standalone: false
})
export class PrepareGameComponent implements OnInit, OnDestroy {
  // like in the game, at least two teams have to play
  public readonly MIN_TEAMS = 2;
  public readonly homeUrl = '/' + baseUrlMaster + pathsMaster.home;

  public navigation: IPrepareNavigationState;
  public ref: IGameRef = null;
  public definition: IGameDefinition = null;
  public state: IGameInstanceState = null;
  // the state's progress with its teams on the buzzers that are there now
  private mappedGameState: IGameState;
  public rows: ITeamRow[] = [];
  public teamsFormGroup = new UntypedFormGroup({});
  // the buzzers of the box ('serial') or the wireless ones ('udp'): a game is played with one kind only, see
  // BuzzerHelper.isMixed
  public buzzerType: IBuzzer['type'] = 'serial';
  public stateName = new UntypedFormControl(GameFileHelper.makeStateName(), Validators.required);
  public error: string = null;
  public starting = false;
  // media the questions show that aren't in the game's media folder, e.g. deleted or never copied in
  public missingMedia: IMissingMedia[] = [];
  public mediaCheckError: string = null;
  // how the screens look in this game
  public readonly themes: IScreenTheme[] = SCREEN_THEMES;
  public themeId: string = ScreenThemeHelper.getLastChosen().id;
  // Jeopardy: a team that answered a tile wrong can't buzz on it again, see IPlayOptions
  public oneTryPerTile = true;
  // Jeopardy, new plays only: the buzzer of the team that picks the first tile, null to choose it on the board
  public firstPickingBuzzerIndex: number | null = null;
  private buzzersSubscription: Subscription;

  constructor(private game: GameService, private storage: StorageService, private router: Router, private dialog: MatDialog) {
    game.useAsMaster();
    this.navigation = (history.state as IPrepareNavigationState)?.gameName ? history.state : null;
  }

  async ngOnInit(): Promise<void> {
    if (this.navigation == null) {
      this.router.navigate([this.homeUrl]);
      return;
    }
    try {
      const location = await this.storage.getLocation(this.navigation.locationId);
      if (location == null) {
        throw new Error('Der Speicherort ist nicht mehr da. Wurde der USB-Stick abgezogen?');
      }
      this.ref = {location, gameName: this.navigation.gameName};
      this.definition = await this.storage.getVersion(this.ref, this.navigation.gameVersion);
      if (this.navigation.stateName != null) {
        this.state = await this.storage.getState(this.ref, this.navigation.stateName);
      }
    } catch (e) {
      this.error = StorageService.getErrorMessage(e);
      return;
    }
    // a continued game keeps its theme; one from before themes gets the default
    if (this.state != null) {
      this.themeId = ScreenThemeHelper.getTheme(this.state.gameState?.themeId).id;
      this.oneTryPerTile = this.state.gameState?.playOptions?.oneTryPerTile !== false;
    }
    this.initTeams();
    await this.findMissingMedia();
  }

  ngOnDestroy(): void {
    this.buzzersSubscription?.unsubscribe();
  }

  private async findMissingMedia(): Promise<void> {
    let tree: IDirectoryTree;
    try {
      tree = await this.storage.getGameMediaTree(this.ref);
    } catch (e) {
      this.mediaCheckError = StorageService.getErrorMessage(e);
      return;
    }
    const existing = new Set<string>();
    const collect = (node: IDirectoryTree) => {
      existing.add(node.path);
      node.children?.forEach(collect);
    };
    collect(tree);
    this.missingMedia = MediaHelper.findMissingMedia(this.definition.rounds, existing);
  }

  public getMissingQuestionNumbers(): string {
    return [...new Set(this.missingMedia.map(media => this.getQuestionLabel(media)))].join(', ');
  }

  /**
   * E.g. "3", or "Runde 2, 3" in a game of several rounds
   */
  public getQuestionLabel(media: IMissingMedia): string {
    return this.definition.rounds.length > 1 ? `Runde ${media.roundNumber}, ${media.questionNumber}` : String(media.questionNumber);
  }

  public getQuestionCount(): number {
    return GameFormatHelper.getAllQuestions(this.definition?.rounds).length;
  }

  public hasJeopardyRound(): boolean {
    return this.definition?.rounds.some(round => round.mode === 'jeopardy') ?? false;
  }

  public hasSeveralJeopardyRounds(): boolean {
    return (this.definition?.rounds.filter(round => round.mode === 'jeopardy').length ?? 0) > 1;
  }

  public getPlayOptions(): IPlayOptions {
    return {oneTryPerTile: this.oneTryPerTile};
  }

  /**
   * The teams that can pick first: the ones that play
   */
  public getActiveRows(): ITeamRow[] {
    return this.rows.filter(row => this.isActive(row));
  }

  public getTeamName(row: ITeamRow): string {
    return (this.teamsFormGroup.get(row.controlName).value ?? '').toString().trim() || 'Team ' + (row.buzzerIndex + 1);
  }

  /**
   * A new play starts with the chosen team picking in the first Jeopardy round; who starts a later one is chosen on its
   * board, and the master can change it
   */
  private makeFirstPickState(teamId: string): IGameState {
    const roundProgress: IGameState['roundProgress'] = {};
    const firstBoard = this.definition.rounds.find(round => round.mode === 'jeopardy');
    if (firstBoard) {
      roundProgress[firstBoard.id] = {pickingTeamId: teamId} as IJeopardyRoundProgress;
    }
    return GameFormatHelper.completeGameState({...GameService.makeInitialGameState(), roundProgress}, this.definition.rounds);
  }

  public chooseTheme(theme: IScreenTheme): void {
    this.themeId = theme.id;
  }

  public isContinuing(): boolean {
    return this.state != null;
  }

  private initTeams(): void {
    // a continued game is played with the buzzers it was played with, also when they haven't turned up yet
    const savedTeam = this.state?.teams?.[0];
    if (savedTeam != null) {
      this.buzzerType = BuzzerHelper.getType(savedTeam.buzzerId);
    }
    this.updateTeams(this.game.getAvailableBuzzers());
    this.buzzersSubscription = this.game.observeAvailableBuzzers().subscribe(buzzers => this.updateTeams(buzzers));
  }

  /**
   * Whether the master can choose the wireless buzzers: once one was found, or for a game that was played with them
   */
  public canChooseBuzzerType(): boolean {
    return this.buzzerType === 'udp' || this.game.getAvailableBuzzers().some(buzzer => BuzzerHelper.isUdpBuzzerId(buzzer.id));
  }

  public chooseBuzzerType(type: IBuzzer['type']): void {
    if (type === this.buzzerType) {
      return;
    }
    this.buzzerType = type;
    this.clearRows();
    this.updateTeams(this.game.getAvailableBuzzers());
  }

  /**
   * The continued game was played with the other kind of buzzers, so its teams don't play on
   */
  public dropsSavedTeams(): boolean {
    const savedTeam = this.state?.teams?.[0];
    return savedTeam != null && BuzzerHelper.getType(savedTeam.buzzerId) !== this.buzzerType;
  }

  private clearRows(): void {
    this.rows = [];
    this.teamsFormGroup = new UntypedFormGroup({});
    // the team that was to pick first has no row any more
    this.firstPickingBuzzerIndex = null;
  }

  /**
   * Puts the teams on the buzzers of the chosen kind, and again whenever these change: a UDP buzzer found later gets a
   * row, and in a continued game its team. The rows that are there keep what was entered.
   */
  private updateTeams(buzzers: IBuzzer[]): void {
    const mapped = this.game.mapTeamsToBuzzers(this.state?.teams ?? [], this.state?.gameState);
    this.mappedGameState = mapped.gameState;
    // a restarted server has new IDs for the buzzers of the box, and may have found the UDP buzzers in another order
    if (this.rows.some(row => buzzers[row.buzzerIndex]?.id !== row.buzzer.id)) {
      this.clearRows();
    }
    buzzers.forEach((buzzer, buzzerIndex) => {
      if (BuzzerHelper.getType(buzzer.id) !== this.buzzerType) {
        return;
      }
      const team = mapped.teams.find(t => t.buzzerIndex === buzzerIndex);
      let row = this.rows.find(r => r.buzzerIndex === buzzerIndex);
      if (row == null) {
        const position = this.rows.length;
        row = {buzzer, buzzerIndex, team, controlName: 'buzzer' + buzzerIndex};
        this.rows.push(row);
        // a new team gets its name in updateDefaultNames()
        const control = new UntypedFormControl(team?.name ?? '', Validators.required);
        // a continued game keeps its teams; a new one starts with as few as can play, the others are added by hand
        if (this.isContinuing() ? team == null : position >= this.MIN_TEAMS) {
          control.disable();
        }
        this.teamsFormGroup.addControl(row.controlName, control);
      } else if (row.team == null && team != null) {
        // the buzzer of a team of the continued game turned up
        const control = this.teamsFormGroup.get(row.controlName);
        control.setValue(team.name);
        control.enable();
      }
      row.buzzer = buzzer;
      row.team = team;
    });
    this.updateDefaultNames();
  }

  /**
   * New teams are named after their buzzer's color, also when it turns up or changes later, as long as the name wasn't
   * changed by hand
   */
  private updateDefaultNames(): void {
    const taken: string[] = [];
    this.rows.forEach((row, position) => {
      if (row.team != null) {
        taken.push(row.team.name);
        return;
      }
      const name = TeamHelper.makeDefaultName(row.buzzer, position, taken);
      taken.push(name);
      const control = this.teamsFormGroup.get(row.controlName);
      if (row.defaultName == null || control.value === row.defaultName) {
        control.setValue(name);
      }
      row.defaultName = name;
    });
  }

  public isActive(row: ITeamRow): boolean {
    return this.teamsFormGroup.get(row.controlName).enabled;
  }

  public setActive(row: ITeamRow, active: boolean): void {
    const control = this.teamsFormGroup.get(row.controlName);
    if (active) {
      control.enable();
    } else {
      control.disable();
      // a team that doesn't play can't pick first, so the board decides again
      if (this.firstPickingBuzzerIndex === row.buzzerIndex) {
        this.firstPickingBuzzerIndex = null;
      }
    }
  }

  /**
   * The color the team on this buzzer has on the screens
   */
  public getColor(row: ITeamRow): string {
    return TeamColorHelper.getBuzzerColor(row.buzzer, row.buzzerIndex);
  }

  public hasCaseColor(row: ITeamRow): boolean {
    return row.buzzer.type === 'udp' && !!row.buzzer.color;
  }

  /**
   * The names of the active teams that share their color with another one, as wireless buzzers in cases of the same
   * color do; on the screens they only differ by their names
   */
  public getTeamsWithSameColor(): string[] {
    const active = this.rows.filter(row => this.isActive(row));
    return active
      .filter(row => active.some(other => other !== row && this.getColor(other) === this.getColor(row)))
      .map(row => this.teamsFormGroup.get(row.controlName).value);
  }

  public getActiveCount(): number {
    return this.rows.filter(row => this.isActive(row)).length;
  }

  public losesPoints(row: ITeamRow): boolean {
    return row.team != null && !this.isActive(row) && (row.team.points ?? 0) !== 0;
  }

  public formatPoints(points: number): string {
    return Math.abs(points) === 1 ? `${points} Punkt` : `${points} Punkte`;
  }

  public getProgress(): string {
    if (this.state == null) {
      const rounds = this.definition.rounds.length;
      return rounds > 1 ? `${rounds} Runden, ${this.getQuestionCount()} Fragen` : `${this.getQuestionCount()} Fragen`;
    }
    // e.g. "Weiter: Frage 4 von 10"
    const progress = GameFormatHelper.describeProgress(GameFormatHelper.getProgress(this.definition.rounds, this.state.gameState));
    return `${this.state.finished ? 'Beendet' : 'Weiter'}: ${progress}`;
  }

  public canStart(): boolean {
    return this.definition != null && this.getQuestionCount() > 0 && this.teamsFormGroup.valid
      && this.getActiveCount() >= this.MIN_TEAMS && (this.isContinuing() || this.stateName.valid && !!this.getStateName())
      && !this.starting;
  }

  private getStateName(): string {
    return StorageApiHelper.sanitizeName(this.stateName.value ?? '');
  }

  public async start(): Promise<void> {
    if (!this.canStart() || !await this.confirmMissingMedia()) {
      return;
    }
    this.starting = true;
    const teams: ITeam[] = this.rows
      .filter(row => this.isActive(row))
      .map(row => ({
        name: this.teamsFormGroup.get(row.controlName).value.toString().trim(),
        buzzerId: row.buzzer.id,
        teamId: row.buzzer.id,
        buzzerIndex: row.buzzerIndex,
        points: row.team?.points ?? 0
      }));
    let gameState: IGameState | undefined;
    if (this.mappedGameState != null) {
      const teamIds = teams.map(team => team.teamId);
      // the server sends states for the rounds of their version, which are completed just in case
      gameState = {
        ...GameFormatHelper.completeGameState(this.mappedGameState, this.definition.rounds),
        markedTeamIds: (this.mappedGameState.markedTeamIds ?? []).filter(id => teamIds.includes(id))
      };
    } else if (this.hasJeopardyRound() && this.firstPickingBuzzerIndex != null) {
      const firstPicking = teams.find(team => team.buzzerIndex === this.firstPickingBuzzerIndex);
      if (firstPicking) {
        gameState = this.makeFirstPickState(firstPicking.teamId);
      }
    }
    // the questions without their own config start as the game's defaults for their media say
    const rounds = StorageService.resolveMediaUrls(this.ref, MediaHelper.applyMediaDefaults(this.definition.rounds, this.definition.mediaDefaults));
    await this.game.setupStoredGame(teams, rounds, gameState, {
      locationId: this.ref.location.id,
      gameName: this.ref.gameName,
      gameVersion: this.definition.version,
      stateName: this.isContinuing() ? this.navigation.stateName : this.getStateName()
    }, !this.isContinuing(), this.themeId, this.hasJeopardyRound() ? this.getPlayOptions() : undefined);
    ScreenThemeHelper.rememberChosen(this.themeId);
    // the server's answer takes the master to the start of the game
  }

  /**
   * Whether to start although media are missing; the screens would show nothing for them
   */
  private async confirmMissingMedia(): Promise<boolean> {
    if (this.missingMedia.length === 0) {
      return true;
    }
    const count = this.missingMedia.length === 1 ? 'Eine Mediendatei fehlt' : `${this.missingMedia.length} Mediendateien fehlen`;
    return this.dialog.open<DialogConfirmComponent, IDialogConfirmData, boolean>(DialogConfirmComponent, {
      data: {
        title: 'Medien fehlen',
        message: `${count} (Frage ${this.getMissingQuestionNumbers()}). Diese Fragen zeigen dann nichts an. Möchtest du trotzdem beginnen?`,
        confirmText: 'Trotzdem beginnen'
      }
    }).afterClosed().toPromise().then(result => !!result);
  }
}
