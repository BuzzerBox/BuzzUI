import {Injectable, inject} from '@angular/core';
import {TranslocoService} from '@jsverse/transloco';
import {Observable} from 'rxjs';
import {LanguageHelper, TLanguage} from '../../../../shared/shared';
import {setActiveLanguage} from './i18n';

const LANGUAGE_STORAGE_KEY = 'buzzerbox.language';

/**
 * The language of the app. The master chooses it (LanguageSwitchComponent) and tells the server, and the screens follow
 * what the server passes on, see GameService. Each browser remembers its last one, so it starts in it: a master the
 * next time, and a screen before a master is there.
 */
@Injectable({
  providedIn: 'root'
})
export class LanguageService {
  public readonly languages = LanguageHelper.LANGUAGES;
  private readonly transloco = inject(TranslocoService);

  /**
   * Once, before the app renders
   */
  public init(): void {
    this.apply(LanguageHelper.normalize(this.read()) ?? LanguageHelper.DEFAULT_LANGUAGE);
  }

  public getLanguage(): TLanguage {
    return LanguageHelper.normalize(this.transloco.getActiveLang()) ?? LanguageHelper.DEFAULT_LANGUAGE;
  }

  public observeLanguage(): Observable<string> {
    return this.transloco.langChanges$;
  }

  /**
   * @param language anything but one of the known languages is ignored
   */
  public setLanguage(language: unknown): void {
    const known = LanguageHelper.normalize(language);
    if (known == null || known === this.getLanguage()) {
      return;
    }
    this.apply(known);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, known);
    } catch {
      // without storage, the language only lasts until the page is loaded again
    }
  }

  private apply(language: TLanguage): void {
    setActiveLanguage(language);
    this.transloco.setActiveLang(language);
    document.documentElement.lang = language;
  }

  private read(): string | null {
    try {
      return localStorage.getItem(LANGUAGE_STORAGE_KEY);
    } catch {
      return null;
    }
  }
}
