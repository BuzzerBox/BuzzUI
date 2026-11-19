import {TeamHelper} from './team.helper';
import {IBuzzer} from '../../../../shared/shared';
import {setActiveLanguage} from '../i18n/i18n';

describe('TeamHelper', () => {
  const udp = (color?: string): IBuzzer => ({id: 'udp:AA:BB:CC:DD:EE:01', keyBind: '', byteBind: '', type: 'udp', color});

  it('names a new team after the color of its buzzer, numbering the same colors', () => {
    expect(TeamHelper.makeDefaultName(udp('#1E88E5'), 0, [])).toBe('Blau');
    expect(TeamHelper.makeDefaultName(udp('#1e88e5'), 3, ['Blau', 'Blau 2'])).toBe('Blau 3');
  });

  it('names it in the language of the master', () => {
    setActiveLanguage('en');
    expect(TeamHelper.makeDefaultName(udp('#1e88e5'), 3, ['Blue'])).toBe('Blue 2');
  });

  it('numbers a team without a color of a case', () => {
    expect(TeamHelper.makeDefaultName(udp(), 2, [])).toBe('Team 3');
    expect(TeamHelper.makeDefaultName(udp('#123456'), 0, [])).toBe('Team 1');
    // a buzzer of the box only has a color for the screens
    expect(TeamHelper.makeDefaultName({...udp('#1e88e5'), type: 'serial'}, 0, [])).toBe('Team 1');
  });
});
