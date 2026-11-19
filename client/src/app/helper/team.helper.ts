import {AbstractControl, FormGroupDirective, NgForm, ValidationErrors, ValidatorFn} from '@angular/forms';
import {ErrorStateMatcher} from '@angular/material/core';
import {BuzzerHelper, IBuzzer, ITeam} from '../../../../shared/shared';
import {t} from '../i18n/i18n';

// TODO what is still needed?
export class TeamHelper {
  private constructor(props) {
    // avoid instantiation
  }

  public static cloneTeam(toClone: ITeam): ITeam {
    return {
      teamId: toClone.teamId,
      points: toClone.points,
      buzzerId: toClone.buzzerId,
      name: toClone.name,
      // the team's color depends on it, see TeamColorHelper
      buzzerIndex: toClone.buzzerIndex,
      color: toClone.color
    };
  }

  /**
   * The name a new team on that buzzer starts with: the color of a wireless buzzer's case ("Blau", "Blau 2" for the
   * next one of that color), or else its position ("Team 3"), in the language at that time
   * @param position of the team among the buzzers that can play
   * @param takenNames the names the teams before it start with
   */
  public static makeDefaultName(buzzer: IBuzzer, position: number, takenNames: string[]): string {
    const caseColor = buzzer.type === 'udp' ? BuzzerHelper.getCaseColor(buzzer.color) : undefined;
    if (caseColor == null) {
      // e.g. a continued game may have a "Team 2" on another buzzer already
      let number = position + 1;
      while (TeamHelper.containsName(takenNames, t('teams.defaultName', {number}))) {
        number++;
      }
      return t('teams.defaultName', {number});
    }
    const colorName = t(`caseColors.${caseColor.key}.name`);
    let name = colorName;
    for (let i = 2; TeamHelper.containsName(takenNames, name); i++) {
      name = `${colorName} ${i}`;
    }
    return name;
  }

  /**
   * Team names are compared without surrounding spaces and ignoring case, so "Blau" and "blau " count as the same
   */
  public static normalizeName(name: unknown): string {
    return (name ?? '').toString().trim().toLocaleLowerCase();
  }

  public static containsName(names: string[], name: string): boolean {
    const normalized = TeamHelper.normalizeName(name);
    return names.some(other => TeamHelper.normalizeName(other) === normalized);
  }

  /**
   * Validator of a form group of team names (one control per team, a disabled one plays no part): the group is invalid
   * while two teams that play have the same name, and its error `duplicateNames` lists the controls that do
   */
  public static readonly distinctNamesValidator: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
    const controls = Object.values((group as AbstractControl & {controls: Record<string, AbstractControl>}).controls ?? {})
      .filter(control => control.enabled && TeamHelper.normalizeName(control.value) !== '');
    const duplicates = controls.filter(control => controls.some(other => other !== control
      && TeamHelper.normalizeName(other.value) === TeamHelper.normalizeName(control.value)));
    return duplicates.length > 0 ? {duplicateNames: duplicates} : null;
  };

  public static hasDuplicateName(control: AbstractControl): boolean {
    const duplicates: AbstractControl[] = control?.parent?.errors?.['duplicateNames'] ?? [];
    return duplicates.includes(control);
  }

  /**
   * Shows a team name's field as faulty right away when another team has that name, and like Material's default
   * otherwise
   */
  public static readonly nameErrorStateMatcher: ErrorStateMatcher = {
    isErrorState: (control: AbstractControl | null, form: FormGroupDirective | NgForm | null): boolean =>
      TeamHelper.hasDuplicateName(control) || !!control?.invalid && (control.touched || !!form?.submitted)
  };

  public static cloneTeams(toClone: ITeam[]): ITeam[] {
    const ret: ITeam[] = [];
    for (const teamToClone of toClone) {
      ret.push(this.cloneTeam(teamToClone));
    }
    return ret;
  }

  public static getTeamsWithMostPoints(teams: ITeam[]): ITeam[] {
    console.dir(teams);
    // points can be negative, so even a team below 0 can have the most
    let points = -Infinity;
    let teamsWithMostPoints: ITeam[] = [];
    for (const team of teams) {
      if (team.points > points) {
        console.log(`team ${team.name} got the most points alone with ${team.points}`);
        points = team.points;
        teamsWithMostPoints = [];
        teamsWithMostPoints.push(team);
      } else if (team.points === points) {
        console.log(`team ${team.name} got also ${team.points} points`);
        teamsWithMostPoints.push(team);
      }
    }
    return teamsWithMostPoints;
  }
}
