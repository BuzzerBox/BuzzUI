import {LanguageHelper, TLanguage} from '../../../../shared/shared';
import de from '../../i18n/de.json';
import en from '../../i18n/en.json';

/**
 * The texts of the app, by language: client/src/i18n/<language>.json. They are part of the bundle rather than loaded
 * when needed, since there are only a few and the box has to show them right away.
 *
 * Templates use Transloco's pipe ({{'common.cancel' | transloco}}), which follows a change of the language. Code uses
 * t() and tn() below, which work without injection, so helpers can use them as well. Both read the same files and
 * fill in {{parameters}} the same way.
 */
export const TRANSLATIONS: Record<TLanguage, Record<string, unknown>> = {de, en};

export const LANGUAGE_NAMES: Record<TLanguage, string> = {de: 'Deutsch', en: 'English'};

let activeLanguage: TLanguage = LanguageHelper.DEFAULT_LANGUAGE;

/**
 * Only for LanguageService, which keeps it the same as Transloco's
 */
export function setActiveLanguage(language: TLanguage): void {
  activeLanguage = language;
}

export function getActiveLanguage(): TLanguage {
  return activeLanguage;
}

function find(language: TLanguage, key: string): string | undefined {
  let node: unknown = TRANSLATIONS[language];
  for (const part of key.split('.')) {
    node = (node as Record<string, unknown> | undefined)?.[part];
  }
  return typeof node === 'string' ? node : undefined;
}

/**
 * The text of a key in the active language, e.g. t('import.imported', {name}) for "„{{name}}“ wurde importiert.". A text
 * that a language lacks comes from the default language, and a key that is unknown altogether is returned as it is.
 */
export function t(key: string, params: Record<string, unknown> = {}): string {
  const text = find(activeLanguage, key) ?? find(LanguageHelper.DEFAULT_LANGUAGE, key) ?? key;
  return text.replace(/{{\s*(\w+)\s*}}/g, (placeholder, name) => name in params ? String(params[name]) : placeholder);
}

/**
 * The key of a text with a number in it: "<key>.one" for 1 (and -1), "<key>.other" for anything else. For templates:
 * {{pluralKey('common.points', points) | transloco: {count: points} }}
 */
export function pluralKey(key: string, count: number): string {
  return `${key}.${Math.abs(count) === 1 ? 'one' : 'other'}`;
}

/**
 * A text with a number in it, which is its parameter {{count}}: tn('common.points', 3) is "3 Punkte"
 */
export function tn(key: string, count: number, params: Record<string, unknown> = {}): string {
  return t(pluralKey(key, count), {count, ...params});
}
