import {TeamColorHelper} from './team-color.helper';
import {ITeam} from '../../../../shared/shared';

describe('TeamColorHelper', () => {
  const team = (teamId: string, buzzerIndex?: number): ITeam => ({teamId, name: teamId, buzzerId: 'b' + teamId, buzzerIndex});

  it('gives a team the color of its buzzer, wherever it is in the list', () => {
    expect(TeamColorHelper.getColor(team('A', 2), [team('B', 0), team('A', 2)])).toBe(TeamColorHelper.PALETTE[2]);
  });

  it('puts teams without a buzzer index on the buzzers in order', () => {
    const teams = [team('A'), team('B')];
    expect(TeamColorHelper.getColor(teams[1], teams)).toBe(TeamColorHelper.PALETTE[1]);
  });

  it('gives the teams of a full box different colors', () => {
    const colors = [...Array(10).keys()].map(i => TeamColorHelper.getColor(team('T' + i, i)));
    expect(new Set(colors).size).toBe(10);
  });
});
