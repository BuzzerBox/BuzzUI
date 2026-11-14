/**
 * The looks the screens can have; the master chooses one for each game when it sets it up (IGameState.themeId).
 *
 * A theme has one of two styles:
 * - "classic": the look from before themes existed, with light Material cards and no effects
 * - "show": a quiz-show look with team colors, the buzz banner, animations and the podium. Its colors and fonts are
 *   CSS variables (--bb-*), set for each theme in themes.scss.
 *
 * Adding a show theme: add it here, its variables to themes.scss, under [data-screen-theme="<id>"], and its name and
 * description to the texts (client/src/i18n).
 */
export type TScreenThemeStyle = 'classic' | 'show';

export interface IScreenTheme {
  // its name and description are the texts "themes.<id>.name" and "themes.<id>.description"
  id: string;
  style: TScreenThemeStyle;
  // the colors of the small preview in the game setup
  preview: {background: string, surface: string, text: string, accent: string};
}

export const SCREEN_THEMES: IScreenTheme[] = [
  {
    id: 'studio',
    style: 'show',
    preview: {background: '#161a35', surface: '#1f2444', text: '#f4f5fb', accent: '#d32f2f'}
  },
  {
    id: 'daylight',
    style: 'show',
    preview: {background: '#e9ecf5', surface: '#ffffff', text: '#161a35', accent: '#d32f2f'}
  },
  {
    id: 'classic',
    style: 'classic',
    preview: {background: '#dddddd', surface: '#ffffff', text: '#222222', accent: '#00ffff'}
  }
];

export const DEFAULT_SCREEN_THEME_ID = 'studio';
