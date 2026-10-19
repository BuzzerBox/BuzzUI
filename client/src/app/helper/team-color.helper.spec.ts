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

  it('gives a team the color the server put on it, e.g. of its buzzer\'s case', () => {
    expect(TeamColorHelper.getColor({...team('A', 2), color: '#1e88e5'})).toBe('#1e88e5');
  });

  it('gives a buzzer its own color, or else the one of its index', () => {
    const buzzer = {id: 'udp:AA:BB:CC:DD:EE:01', keyBind: '', byteBind: '', type: 'udp' as const};
    expect(TeamColorHelper.getBuzzerColor({...buzzer, color: '#fdd835'}, 11)).toBe('#fdd835');
    expect(TeamColorHelper.getBuzzerColor(buzzer, 11)).toBe(TeamColorHelper.PALETTE[1]);
  });
});
