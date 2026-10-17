import {ScreenThemeHelper} from './screen-theme.helper';
import {DEFAULT_SCREEN_THEME_ID, SCREEN_THEMES} from './screen-themes';

describe('ScreenThemeHelper', () => {
  afterEach(() => document.documentElement.removeAttribute('data-screen-theme'));

  it('falls back to the default theme for states from before themes and for unknown themes', () => {
    expect(ScreenThemeHelper.getTheme(undefined).id).toBe(DEFAULT_SCREEN_THEME_ID);
    expect(ScreenThemeHelper.getTheme('from-a-newer-version').id).toBe(DEFAULT_SCREEN_THEME_ID);
  });

  it('keeps the previous look as the classic theme', () => {
    expect(ScreenThemeHelper.isShowStyle('classic')).toBeFalse();
    expect(ScreenThemeHelper.isShowStyle('studio')).toBeTrue();
  });

  it('puts the theme onto the page and remembers it for the waiting screen', () => {
    ScreenThemeHelper.apply('daylight');
    expect(document.documentElement.getAttribute('data-screen-theme')).toBe('daylight');
    expect(ScreenThemeHelper.getStored().id).toBe('daylight');
  });

  it('has themes with unique IDs', () => {
    expect(new Set(SCREEN_THEMES.map(theme => theme.id)).size).toBe(SCREEN_THEMES.length);
  });
});
