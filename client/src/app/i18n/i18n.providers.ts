import {EnvironmentProviders, Injectable, Provider, inject, isDevMode, provideAppInitializer} from '@angular/core';
import {provideTransloco, Translation, TranslocoLoader, TranslocoService} from '@jsverse/transloco';
import {Observable, of} from 'rxjs';
import {LanguageHelper} from '../../../../shared/shared';
import {TRANSLATIONS} from './i18n';
import {LanguageService} from './language.service';

@Injectable()
export class BundledTranslationLoader implements TranslocoLoader {
  public getTranslation(language: string): Observable<Translation> {
    return of(TRANSLATIONS[LanguageHelper.normalize(language) ?? LanguageHelper.DEFAULT_LANGUAGE] as Translation);
  }
}

/**
 * Transloco with the bundled texts of all languages, starting in the language this browser used last
 */
export function provideI18n(): (Provider | EnvironmentProviders)[] {
  return [
    provideTransloco({
      config: {
        availableLangs: [...LanguageHelper.LANGUAGES],
        defaultLang: LanguageHelper.DEFAULT_LANGUAGE,
        fallbackLang: LanguageHelper.DEFAULT_LANGUAGE,
        missingHandler: {useFallbackTranslation: true},
        reRenderOnLangChange: true,
        prodMode: !isDevMode()
      },
      loader: BundledTranslationLoader
    }),
    provideAppInitializer(() => {
      const transloco = inject(TranslocoService);
      // the loader answers at once, so every language is there before the first text is asked for
      LanguageHelper.LANGUAGES.forEach(language => transloco.load(language).subscribe());
      inject(LanguageService).init();
    })
  ];
}
