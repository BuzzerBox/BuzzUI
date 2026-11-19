import {ModuleWithProviders} from '@angular/core';
import {Translation, TranslocoTestingModule} from '@jsverse/transloco';
import {LanguageHelper, TLanguage} from '../../../../shared/shared';
import {TRANSLATIONS} from './i18n';

/**
 * The language of the specs: they check German texts, whatever the app's default (LanguageHelper.DEFAULT_LANGUAGE) is
 */
export const SPEC_LANGUAGE: TLanguage = 'de';

/**
 * The real texts for specs, in SPEC_LANGUAGE. test.ts gives it to every spec, so a component under test can use the
 * transloco pipe without importing anything.
 */
export function getI18nTestingModule(): ModuleWithProviders<TranslocoTestingModule> {
  return TranslocoTestingModule.forRoot({
    langs: TRANSLATIONS as Record<string, Translation>,
    translocoConfig: {
      availableLangs: [...LanguageHelper.LANGUAGES],
      defaultLang: SPEC_LANGUAGE,
      fallbackLang: SPEC_LANGUAGE,
      missingHandler: {useFallbackTranslation: true},
      reRenderOnLangChange: true
    },
    preloadLangs: true
  });
}
