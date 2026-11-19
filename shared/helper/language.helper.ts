/**
 * The languages the master and the screens can show. The master chooses one, and the screens follow it, see
 * ISetLanguagePacket. The texts themselves are in the client (client/src/i18n/<language>.json).
 */
export type TLanguage = 'de' | 'en';

export class LanguageHelper {
    public static readonly LANGUAGES: TLanguage[] = ['de', 'en'];
    // until the master chooses one, and for a text a language lacks
    public static readonly DEFAULT_LANGUAGE: TLanguage = 'en';

    private constructor() {
        // hide constructor
    }

    /**
     * One of the LANGUAGES; anything else, e.g. the language of a newer version, is no language
     */
    public static normalize(language: unknown): TLanguage | undefined {
        return LanguageHelper.LANGUAGES.find(known => known === language);
    }
}
