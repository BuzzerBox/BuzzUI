import {UntypedFormControl, UntypedFormGroup} from '@angular/forms';
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

  it('skips a numbered name another team has already', () => {
    expect(TeamHelper.makeDefaultName(udp(), 1, ['Team 2'])).toBe('Team 3');
    expect(TeamHelper.makeDefaultName(udp('#1e88e5'), 0, ['blau'])).toBe('Blau 2');
  });

  describe('distinctNamesValidator', () => {
    const makeGroup = (...names: string[]) => new UntypedFormGroup(
      Object.fromEntries(names.map((name, i) => ['team' + i, new UntypedFormControl(name)])),
      {validators: TeamHelper.distinctNamesValidator});

    it('accepts different names', () => {
      expect(makeGroup('Blau', 'Rot', 'Team 3').valid).toBeTrue();
    });

    it('marks the teams with the same name, ignoring case and spaces', () => {
      const group = makeGroup('Blau', 'Rot', ' blau ');
      expect(group.valid).toBeFalse();
      expect(TeamHelper.hasDuplicateName(group.get('team0'))).toBeTrue();
      expect(TeamHelper.hasDuplicateName(group.get('team1'))).toBeFalse();
      expect(TeamHelper.hasDuplicateName(group.get('team2'))).toBeTrue();
    });

    it('ignores teams that do not play and empty names', () => {
      const group = makeGroup('Blau', 'Blau', '', '');
      group.get('team1').disable();
      expect(group.valid).toBeTrue();
      group.get('team1').enable();
      expect(group.valid).toBeFalse();
      group.get('team1').setValue('Grün');
      expect(group.valid).toBeTrue();
    });
  });
});
