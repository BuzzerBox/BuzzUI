import {IBuzzer} from '../../../../shared/shared';
import {setActiveLanguage} from '../i18n/i18n';
import {BuzzerNameHelper} from './buzzer-name.helper';

describe('BuzzerNameHelper', () => {
  const udp = (macEnd: string, color?: string): IBuzzer =>
    ({id: 'udp:14:2B:2F:AF:' + macEnd, keyBind: '', byteBind: '', type: 'udp', color});

  it('names a wireless buzzer after its color', () => {
    expect(BuzzerNameHelper.getUdpName('14:2b:2f:af:8f:dc', '#1e88e5')).toBe('Blauer Wireless Buzzer');
    expect(BuzzerNameHelper.getUdpName('14:2b:2f:af:8f:dc', '#8e24aa')).toBe('Lila Wireless Buzzer');
    expect(BuzzerNameHelper.getUdpName('14:2b:2f:af:8f:dc', '#1e88e5', true)).toBe('Blauer Wireless Buzzer (8F:DC)');
  });

  it('names one without a color after its MAC address', () => {
    expect(BuzzerNameHelper.getUdpName('14:2b:2f:af:8f:dc')).toBe('Funkbuzzer 8F:DC');
    expect(BuzzerNameHelper.getUdpName('14:2b:2f:af:8f:dc', undefined, true)).toBe('Funkbuzzer 8F:DC');
  });

  it('tells buzzers of the same color apart by their MAC addresses', () => {
    const blue = udp('8F:DC', '#1e88e5');
    const otherBlue = udp('11:22', '#1e88e5');
    const pink = udp('33:44', '#ec407a');
    const buzzers = [blue, otherBlue, pink];
    expect(BuzzerNameHelper.getName(blue, buzzers)).toBe('Blauer Wireless Buzzer (8F:DC)');
    expect(BuzzerNameHelper.getName(otherBlue, buzzers)).toBe('Blauer Wireless Buzzer (11:22)');
    expect(BuzzerNameHelper.getName(pink, buzzers)).toBe('Pinker Wireless Buzzer');
    expect(BuzzerNameHelper.getName(blue, [blue, pink])).toBe('Blauer Wireless Buzzer');
  });

  it('keeps the name a buzzer of the box has in the config', () => {
    expect(BuzzerNameHelper.getName({id: 'abc', name: 'Buzzer 1', keyBind: '1', byteBind: '1', color: '#1e88e5'})).toBe('Buzzer 1');
  });

  it('names them in the language of the master', () => {
    setActiveLanguage('en');
    expect(BuzzerNameHelper.getUdpName('14:2b:2f:af:8f:dc', '#1e88e5')).toBe('Blue wireless buzzer');
    expect(BuzzerNameHelper.getUdpName('14:2b:2f:af:8f:dc')).toBe('Wireless buzzer 8F:DC');
  });
});
