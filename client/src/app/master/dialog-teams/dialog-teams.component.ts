import {Component, OnDestroy} from '@angular/core';
import {UntypedFormControl, UntypedFormGroup, Validators} from '@angular/forms';
import {MatDialogRef} from '@angular/material/dialog';
import {Subscription} from 'rxjs';
import {BuzzerHelper, IBuzzer, ITeam} from '../../../../../shared/shared';
import {GameService} from '../../services/game.service';
import {TeamColorHelper} from '../../helper/team-color.helper';

interface ITeamRow {
  buzzer: IBuzzer;
  buzzerIndex: number;
  // the team that is on this buzzer now, if any
  team?: ITeam;
  controlName: string;
}

/**
 * Changes the teams while the game is running, like the teams step of the setup: one row per buzzer of the kind the game
 * is played with (BuzzerHelper.isMixed), which can be activated for a team or not
 */
@Component({
    selector: 'app-dialog-teams',
    templateUrl: './dialog-teams.component.html',
    styleUrls: ['./dialog-teams.component.css'],
    standalone: false
})
export class DialogTeamsComponent implements OnDestroy {
  // like in the setup, a game needs at least two teams
  public readonly MIN_TEAMS = 2;

  public rows: ITeamRow[] = [];
  public teamsFormGroup = new UntypedFormGroup({});
  private buzzersSubscription: Subscription;
  private readonly buzzerType: IBuzzer['type'];

  constructor(private game: GameService, private dialogRef: MatDialogRef<DialogTeamsComponent>) {
    this.buzzerType = BuzzerHelper.getType(this.game.getTeams()?.[0]?.buzzerId);
    this.updateRows(this.game.getAvailableBuzzers());
    // a UDP buzzer found while the dialog is open can be added right away
    this.buzzersSubscription = this.game.observeAvailableBuzzers().subscribe(buzzers => this.updateRows(buzzers));
  }

  ngOnDestroy(): void {
    this.buzzersSubscription?.unsubscribe();
  }

  /**
   * One row per buzzer of the game's kind; the rows that are there keep what was entered
   */
  private updateRows(buzzers: IBuzzer[]): void {
    const teams = this.game.getTeams() ?? [];
    // a restarted server has new IDs for the buzzers of the box, and may have found the UDP buzzers in another order
    if (this.rows.some(row => buzzers[row.buzzerIndex]?.id !== row.buzzer.id)) {
      this.rows = [];
      this.teamsFormGroup = new UntypedFormGroup({});
    }
    buzzers.forEach((buzzer, buzzerIndex) => {
      if (BuzzerHelper.getType(buzzer.id) !== this.buzzerType) {
        return;
      }
      const team = teams.find(t => t.buzzerId === buzzer.id);
      let row = this.rows.find(r => r.buzzerIndex === buzzerIndex);
      if (row == null) {
        const position = this.rows.length;
        row = {buzzer, buzzerIndex, team, controlName: 'buzzer' + buzzerIndex};
        this.rows.push(row);
        const control = new UntypedFormControl(team?.name ?? 'Team ' + (position + 1), Validators.required);
        if (team == null) {
          control.disable();
        }
        this.teamsFormGroup.addControl(row.controlName, control);
      }
      row.buzzer = buzzer;
      row.team = team;
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

  public getActiveCount(): number {
    return this.rows.filter(row => this.isActive(row)).length;
  }

  /**
   * Whether this team would be removed, losing its points
   */
  public losesPoints(row: ITeamRow): boolean {
    return row.team != null && !this.isActive(row) && (row.team.points ?? 0) !== 0;
  }

  public canSave(): boolean {
    return this.teamsFormGroup.valid && this.getActiveCount() >= this.MIN_TEAMS;
  }

  public formatPoints(points: number): string {
    return Math.abs(points) === 1 ? `${points} Punkt` : `${points} Punkte`;
  }

  public save(): void {
    if (!this.canSave()) {
      return;
    }
    const teams: ITeam[] = this.rows
      .filter(row => this.isActive(row))
      .map(row => ({
        name: this.teamsFormGroup.get(row.controlName).value.toString().trim(),
        buzzerId: row.buzzer.id,
        teamId: row.buzzer.id,
        buzzerIndex: row.buzzerIndex,
        // the server keeps the points of teams it already has
        points: row.team?.points ?? 0
      }));
    this.game.updateTeams(teams);
    this.dialogRef.close();
  }
}
