import {Component, OnInit} from '@angular/core';
import {Router} from '@angular/router';
import {UntypedFormControl, UntypedFormGroup, Validators} from '@angular/forms';
import {MatDialog} from '@angular/material/dialog';
import {IBuzzer, IDirectoryTree, IGameDefinition, IGameInstanceState, IGameState, ITeam, MediaHelper, StorageApiHelper} from '../../../../../shared/shared';
import {GameService} from '../../services/game.service';
import {IGameRef, StorageService} from '../../services/storage.service';
import {GameFileHelper} from '../../helper/game-file.helper';
import {IPrepareNavigationState} from '../game-navigation';
import {baseUrlMaster, pathsMaster} from '../paths-master';
import {DialogConfirmComponent, IDialogConfirmData} from '../dialog-confirm/dialog-confirm.component';

interface ITeamRow {
  buzzer: IBuzzer;
  buzzerIndex: number;
  // the team of the continued state that is on this buzzer, if any
  team?: ITeam;
  controlName: string;
}

interface IMissingMedia {
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
  // media the questions show that aren't in the game's media folder, e.g. deleted or never copied in
  public missingMedia: IMissingMedia[] = [];
  public mediaCheckError: string = null;

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
    this.initTeams();
    await this.findMissingMedia();
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
    this.missingMedia = MediaHelper.findMissingMedia(this.definition.questions, existing);
  }

  public getMissingQuestionNumbers(): string {
    return [...new Set(this.missingMedia.map(media => media.questionNumber))].join(', ');
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
      // a continued game keeps its teams; a new one starts with as few as can play, the others are added by hand
      if (this.isContinuing() ? row.team == null : row.buzzerIndex >= this.MIN_TEAMS) {
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
      const lastQuestion = Math.max(0, this.definition.questions.length - 1);
      gameState = {
        ...this.mappedGameState,
        currentQuestionNumber: Math.min(this.mappedGameState.currentQuestionNumber ?? 0, lastQuestion),
        markedTeamIds: (this.mappedGameState.markedTeamIds ?? []).filter(id => teamIds.includes(id))
      };
    }
    // the questions without their own config start as the game's defaults for their media say
    const questions = StorageService.resolveMediaUrls(this.ref, MediaHelper.applyMediaDefaults(this.definition.questions, this.definition.mediaDefaults));
    await this.game.setupStoredGame(teams, questions, gameState, {
      locationId: this.ref.location.id,
      gameName: this.ref.gameName,
      gameVersion: this.definition.version,
      stateName: this.isContinuing() ? this.navigation.stateName : this.getStateName()
    }, !this.isContinuing());
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
