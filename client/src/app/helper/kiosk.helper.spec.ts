import {KioskHelper} from './kiosk.helper';

describe('KioskHelper.isTouchDisplay', () => {
  const makeStorage = (): Pick<Storage, 'getItem' | 'setItem'> => {
    const items = new Map<string, string>();
    return {getItem: key => items.get(key) ?? null, setItem: (key, value) => items.set(key, value)};
  };

  it('takes the flag from the URL and remembers it for the pages after', () => {
    const storage = makeStorage();
    expect(KioskHelper.isTouchDisplay('?touchDisplay=1', storage)).toBeTrue();
    expect(KioskHelper.isTouchDisplay('', storage)).toBeTrue();
  });

  it('is off for every other device', () => {
    expect(KioskHelper.isTouchDisplay('', makeStorage())).toBeFalse();
    expect(KioskHelper.isTouchDisplay('?touchDisplay=0', makeStorage())).toBeFalse();
    expect(KioskHelper.isTouchDisplay('?touchDisplay=1', undefined)).toBeTrue();
    expect(KioskHelper.isTouchDisplay('', undefined)).toBeFalse();
  });

  it('works without a usable storage', () => {
    const broken = {getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }};
    expect(KioskHelper.isTouchDisplay('?touchDisplay=1', broken)).toBeTrue();
    expect(KioskHelper.isTouchDisplay('', broken)).toBeFalse();
  });
});
