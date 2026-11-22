import {BoxSettingsHelper, TLanguage} from '../../../../shared/shared';
import {TRANSLATIONS} from '../i18n/i18n';
import {IClientExtension} from './client-extension';
import {SERIAL_BUZZERS_CLIENT_EXTENSION} from './serial-buzzers/serial-buzzers.client-extension';

/**
 * The extensions of this build, see docs/extensions.md. A build with other extensions replaces this file through
 * fileReplacements in its angular.json; it must export CLIENT_EXTENSIONS and registerClientExtensions() as well.
 */
export const CLIENT_EXTENSIONS: IClientExtension[] = [
  SERIAL_BUZZERS_CLIENT_EXTENSION
];

let isRegistered = false;

/**
 * Registers what the extensions add outside of Angular: their box settings and their texts. main.ts calls it before
 * the app starts, and test.ts before the specs run.
 */
export function registerClientExtensions(extensions: IClientExtension[] = CLIENT_EXTENSIONS): void {
  if (isRegistered) {
    return;
  }
  isRegistered = true;
  for (const extension of extensions) {
    extension.boxSettings?.forEach(definition => BoxSettingsHelper.register(definition));
    for (const [language, texts] of Object.entries(extension.translations ?? {})) {
      mergeTexts(TRANSLATIONS[language as TLanguage] as Record<string, unknown>, texts);
    }
  }
}

function mergeTexts(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(source)) {
    const existing = target[key];
    if (value != null && typeof value === 'object' && existing != null && typeof existing === 'object') {
      mergeTexts(existing as Record<string, unknown>, value as Record<string, unknown>);
    } else {
      target[key] = value;
    }
  }
}
