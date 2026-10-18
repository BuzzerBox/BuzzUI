import {Component, OnDestroy} from '@angular/core';
import {UntypedFormControl, UntypedFormGroup, Validators} from '@angular/forms';
import {MatDialogRef} from '@angular/material/dialog';
import {Subscription} from 'rxjs';
import {IBuzzer, ITeam} from '../../../../../shared/shared';
import {GameService} from '../../services/game.service';

interface ITeamRow {
  buzzer: IBuzzer;
  buzzerIndex: number;
  // the team that is on this buzzer now, if any
  team?: ITeam;
  controlName: string;
}

/**
 * Changes the teams while the game is running, like the teams step of the setup: one row per buzzer, which can be
 * activated for a team or not
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

  constructor(private game: GameService, private dialogRef: MatDialogRef<DialogTeamsComponent>) {
    this.updateRows(this.game.getAvailableBuzzers());
    // a UDP buzzer found while the dialog is open can be added right away
    this.buzzersSubscription = this.game.observeAvailableBuzzers().subscribe(buzzers => this.updateRows(buzzers));
  }

  ngOnDestroy(): void {
    this.buzzersSubscription?.unsubscribe();
  }

  /**
   * One row per buzzer; the rows that are there keep what was entered
   */
  private updateRows(buzzers: IBuzzer[]): void {
    const teams = this.game.getTeams() ?? [];
    if (buzzers.length < this.rows.length) {
      // only a restarted server has fewer buzzers, which may be in another order now
      this.rows = [];
      this.teamsFormGroup = new UntypedFormGroup({});
    }
    buzzers.forEach((buzzer, buzzerIndex) => {
      const team = teams.find(t => t.buzzerId === buzzer.id);
      let row = this.rows[buzzerIndex];
      if (row == null) {
        row = {buzzer, buzzerIndex, team, controlName: 'buzzer' + buzzerIndex};
        this.rows.push(row);
        const control = new UntypedFormControl(team?.name ?? 'Team ' + (buzzerIndex + 1), Validators.required);
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
