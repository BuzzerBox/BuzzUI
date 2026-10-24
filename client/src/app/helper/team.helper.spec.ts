import {TeamHelper} from './team.helper';
import {BuzzerHelper, IBuzzer} from '../../../../shared/shared';

describe('TeamHelper', () => {
  const udp = (color?: string): IBuzzer => ({id: 'udp:AA:BB:CC:DD:EE:01', keyBind: '', byteBind: '', type: 'udp', color});

  it('names a new team after the color of its buzzer, numbering the same colors', () => {
    expect(TeamHelper.makeDefaultName(udp('#1E88E5'), 0, [])).toBe('Blau');
    expect(TeamHelper.makeDefaultName(udp('#1e88e5'), 3, ['Blau', 'Blau 2'])).toBe('Blau 3');
  });

  it('numbers a team without a color of a case', () => {
    expect(TeamHelper.makeDefaultName(udp(), 2, [])).toBe('Team 3');
    expect(TeamHelper.makeDefaultName(udp('#123456'), 0, [])).toBe('Team 1');
    // a buzzer of the box only has a color for the screens
    expect(TeamHelper.makeDefaultName({...udp('#1e88e5'), type: 'serial'}, 0, [])).toBe('Team 1');
  });
});

describe('BuzzerHelper.makeUdpBuzzerName', () => {
  it('names a wireless buzzer after its color', () => {
    expect(BuzzerHelper.makeUdpBuzzerName('14:2b:2f:af:8f:dc', '#1e88e5')).toBe('Blauer Wireless Buzzer');
    expect(BuzzerHelper.makeUdpBuzzerName('14:2b:2f:af:8f:dc', '#8e24aa')).toBe('Lila Wireless Buzzer');
    expect(BuzzerHelper.makeUdpBuzzerName('14:2b:2f:af:8f:dc', '#1e88e5', true)).toBe('Blauer Wireless Buzzer (8F:DC)');
  });

  it('names one without a color after its MAC address', () => {
    expect(BuzzerHelper.makeUdpBuzzerName('14:2b:2f:af:8f:dc')).toBe('Funkbuzzer 8F:DC');
    expect(BuzzerHelper.makeUdpBuzzerName('14:2b:2f:af:8f:dc', undefined, true)).toBe('Funkbuzzer 8F:DC');
  });
});
