/**
 * The looks the screens can have; the master chooses one for each game when it sets it up (IGameState.themeId).
 *
 * A theme has one of two styles:
 * - "classic": the look from before themes existed, with light Material cards and no effects
 * - "show": a quiz-show look with team colors, the buzz banner, animations and the podium. Its colors and fonts are
 *   CSS variables (--bb-*), set for each theme in themes.scss.
 *
 * Adding a show theme: add it here and its variables to themes.scss, under [data-screen-theme="<id>"].
 */
export type TScreenThemeStyle = 'classic' | 'show';

export interface IScreenTheme {
  id: string;
  name: string;
  description: string;
  style: TScreenThemeStyle;
  // the colors of the small preview in the game setup
  preview: {background: string, surface: string, text: string, accent: string};
}

export const SCREEN_THEMES: IScreenTheme[] = [
  {
    id: 'studio',
    name: 'Studio',
    description: 'Dunkel wie im Fernsehstudio, mit Teamfarben, Effekten und Siegertreppchen',
    style: 'show',
    preview: {background: '#161a35', surface: '#1f2444', text: '#f4f5fb', accent: '#d32f2f'}
  },
  {
    id: 'daylight',
    name: 'Tageslicht',
    description: 'Wie Studio, aber hell, für helle Räume und Beamer',
    style: 'show',
    preview: {background: '#e9ecf5', surface: '#ffffff', text: '#161a35', accent: '#d32f2f'}
  },
  {
    id: 'classic',
    name: 'Klassisch',
    description: 'Das schlichte Aussehen der früheren Versionen, ohne Effekte',
    style: 'classic',
    preview: {background: '#dddddd', surface: '#ffffff', text: '#222222', accent: '#00ffff'}
  }
];

export const DEFAULT_SCREEN_THEME_ID = 'studio';
