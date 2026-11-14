import {ModuleWithProviders} from '@angular/core';
import {Translation, TranslocoTestingModule} from '@jsverse/transloco';
import {LanguageHelper} from '../../../../shared/shared';
import {TRANSLATIONS} from './i18n';

/**
 * The real texts for specs, in the default language (German). test.ts gives it to every spec, so a component under
 * test can use the transloco pipe without importing anything.
 */
export function getI18nTestingModule(): ModuleWithProviders<TranslocoTestingModule> {
  return TranslocoTestingModule.forRoot({
    langs: TRANSLATIONS as Record<string, Translation>,
    translocoConfig: {
      availableLangs: [...LanguageHelper.LANGUAGES],
      defaultLang: LanguageHelper.DEFAULT_LANGUAGE,
      fallbackLang: LanguageHelper.DEFAULT_LANGUAGE,
      missingHandler: {useFallbackTranslation: true},
      reRenderOnLangChange: true
    },
    preloadLangs: true
  });
}
