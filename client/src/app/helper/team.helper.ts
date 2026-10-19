import {ITeam} from '../../../../shared/shared';

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
