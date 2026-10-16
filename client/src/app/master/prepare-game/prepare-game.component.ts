import {Component, OnInit} from '@angular/core';
import {Router} from '@angular/router';
import {UntypedFormControl, UntypedFormGroup, Validators} from '@angular/forms';
import {IBuzzer, IGameDefinition, IGameInstanceState, IGameState, ITeam, StorageApiHelper} from '../../../../../shared/shared';
import {GameService} from '../../services/game.service';
import {IGameRef, StorageService} from '../../services/storage.service';
import {GameFileHelper} from '../../helper/game-file.helper';
import {IPrepareNavigationState} from '../game-navigation';
import {baseUrlMaster, pathsMaster} from '../paths-master';

interface ITeamRow {
  buzzer: IBuzzer;
  buzzerIndex: number;
  // the team of the continued state that is on this buzzer, if any
  team?: ITeam;
  controlName: string;
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
export class PrepareGameComponent implements OnInit {
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
  public stateName = new UntypedFormControl(GameFileHelper.makeStateName(), Validators.required);
  public error: string = null;
  public starting = false;

  constructor(private game: GameService, private storage: StorageService, private router: Router) {
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
    this.initTeams();
  }

  public isContinuing(): boolean {
    return this.state != null;
  }

  private initTeams(): void {
    const mapped = this.game.mapTeamsToBuzzers(this.state?.teams ?? [], this.state?.gameState);
    this.mappedGameState = mapped.gameState;
    this.rows = this.game.getAvailableBuzzers().map((buzzer, buzzerIndex) => ({
      buzzer,
      buzzerIndex,
      team: mapped.teams.find(team => team.buzzerIndex === buzzerIndex),
      controlName: 'buzzer' + buzzerIndex
    }));
    const controls: Record<string, UntypedFormControl> = {};
    for (const row of this.rows) {
      const control = new UntypedFormControl(row.team?.name ?? 'Team ' + (row.buzzerIndex + 1), Validators.required);
      // a continued game keeps its teams; a new one starts with all buzzers
      if (this.isContinuing() && row.team == null) {
        control.disable();
      }
      controls[row.controlName] = control;
    }
    this.teamsFormGroup = new UntypedFormGroup(controls);
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
    }
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
    const questionCount = this.definition.questions.length;
    if (this.state == null) {
      return `${questionCount} Fragen`;
    }
    const current = Math.min((this.state.gameState?.currentQuestionNumber ?? 0) + 1, questionCount);
    return `${this.state.finished ? 'Beendet' : 'Weiter'} bei Frage ${current} von ${questionCount}`;
  }

  public canStart(): boolean {
    return this.definition != null && this.definition.questions.length > 0 && this.teamsFormGroup.valid
      && this.getActiveCount() >= this.MIN_TEAMS && (this.isContinuing() || this.stateName.valid && !!this.getStateName())
      && !this.starting;
  }

  private getStateName(): string {
    return StorageApiHelper.sanitizeName(this.stateName.value ?? '');
  }

  public async start(): Promise<void> {
    if (!this.canStart()) {
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
      const lastQuestion = Math.max(0, this.definition.questions.length - 1);
      gameState = {
        ...this.mappedGameState,
        currentQuestionNumber: Math.min(this.mappedGameState.currentQuestionNumber ?? 0, lastQuestion),
        markedTeamIds: (this.mappedGameState.markedTeamIds ?? []).filter(id => teamIds.includes(id))
      };
    }
    const questions = StorageService.resolveMediaUrls(this.ref, this.definition.questions);
    await this.game.setupStoredGame(teams, questions, gameState, {
      locationId: this.ref.location.id,
      gameName: this.ref.gameName,
      gameVersion: this.definition.version,
      stateName: this.isContinuing() ? this.navigation.stateName : this.getStateName()
    }, !this.isContinuing());
    // the server's answer takes the master to the start of the game
  }
}
