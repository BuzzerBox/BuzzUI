import {Component} from '@angular/core';
import {UntypedFormControl, UntypedFormGroup, Validators} from '@angular/forms';
import {MatDialogRef} from '@angular/material/dialog';
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
export class DialogTeamsComponent {
  // like in the setup, a game needs at least two teams
  public readonly MIN_TEAMS = 2;

  public rows: ITeamRow[];
  public teamsFormGroup: UntypedFormGroup;

  constructor(private game: GameService, private dialogRef: MatDialogRef<DialogTeamsComponent>) {
    const teams = this.game.getTeams() ?? [];
    this.rows = this.game.getAvailableBuzzers().map((buzzer, buzzerIndex) => ({
      buzzer,
      buzzerIndex,
      team: teams.find(team => team.buzzerId === buzzer.id),
      controlName: 'buzzer' + buzzerIndex
    }));
    const controls: Record<string, UntypedFormControl> = {};
    for (const row of this.rows) {
      const control = new UntypedFormControl(row.team?.name ?? 'Team ' + (row.buzzerIndex + 1), Validators.required);
      if (row.team == null) {
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
