import {DEFAULT_SCREEN_THEME_ID, IScreenTheme, SCREEN_THEMES} from './screen-themes';

/**
 * Finds the screen themes and puts one onto the page, see screen-themes.ts
 */
export class ScreenThemeHelper {
  // a screen shows the theme of its last game while it waits for the next one
  private static readonly STORAGE_KEY = 'buzzerbox-screen-theme';
  // the master suggests the theme it used last for a new game
  private static readonly LAST_CHOSEN_KEY = 'buzzerbox-last-chosen-theme';

  private constructor() {
    // avoid instantiation
  }

  /**
   * An unknown or missing ID (e.g. a state from before themes existed) gives the default theme
   */
  public static getTheme(id?: string | null): IScreenTheme {
    return SCREEN_THEMES.find(theme => theme.id === id) ?? SCREEN_THEMES.find(theme => theme.id === DEFAULT_SCREEN_THEME_ID);
  }

  public static isShowStyle(id?: string | null): boolean {
    return this.getTheme(id).style === 'show';
  }

  /**
   * Sets the theme's variables on the whole page (they are in themes.scss) and remembers it for the waiting screen
   */
  public static apply(id?: string | null): void {
    const theme = this.getTheme(id);
    document.documentElement.setAttribute('data-screen-theme', theme.id);
    this.write(this.STORAGE_KEY, theme.id);
  }

  /**
   * The theme of the screen's last game; the default one before its first
   */
  public static getStored(): IScreenTheme {
    return this.getTheme(this.read(this.STORAGE_KEY));
  }

  public static getLastChosen(): IScreenTheme {
    return this.getTheme(this.read(this.LAST_CHOSEN_KEY));
  }

  public static rememberChosen(id: string): void {
    this.write(this.LAST_CHOSEN_KEY, id);
  }

  // the browser may not allow storage (e.g. in a private window); the default theme does then
  private static read(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private static write(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // see read()
    }
  }
}
