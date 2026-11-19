import {TestBed} from '@angular/core/testing';
import {TranslocoService} from '@jsverse/transloco';
import {LanguageHelper} from '../../../../shared/shared';
import {pluralKey, setActiveLanguage, t, tn, TRANSLATIONS} from './i18n';
import {LanguageService} from './language.service';
import {SPEC_LANGUAGE} from './i18n-testing.module';

function flatten(texts: Record<string, unknown>, prefix = ''): Record<string, string> {
  return Object.entries(texts).reduce((all, [key, value]) => typeof value === 'string'
    ? {...all, [prefix + key]: value}
    : {...all, ...flatten(value as Record<string, unknown>, prefix + key + '.')}, {} as Record<string, string>);
}

const placeholders = (text: string) => (text.match(/{{\s*\w+\s*}}/g) ?? []).map(p => p.replace(/[{}\s]/g, '')).sort();

describe('translations', () => {
  const reference = flatten(TRANSLATIONS[LanguageHelper.DEFAULT_LANGUAGE]);

  LanguageHelper.LANGUAGES.forEach(language => {
    it(`has every text in "${language}", with the same parameters`, () => {
      const texts = flatten(TRANSLATIONS[language]);
      expect(Object.keys(texts).sort()).toEqual(Object.keys(reference).sort());
      Object.keys(reference).forEach(key => {
        expect(placeholders(texts[key] ?? '')).withContext(key).toEqual(placeholders(reference[key]));
      });
    });
  });

  it('has both forms of every text with a number', () => {
    Object.keys(reference).filter(key => key.endsWith('.one')).forEach(key => {
      expect(reference[key.replace(/\.one$/, '.other')]).withContext(key).toBeDefined();
    });
    Object.keys(reference).filter(key => key.endsWith('.other')).forEach(key => {
      expect(reference[key.replace(/\.other$/, '.one')]).withContext(key).toBeDefined();
    });
  });
});

describe('t', () => {
  it('fills in the parameters', () => {
    expect(t('home.welcome', {name: 'BuzzerBox'})).toBe('Willkommen bei BuzzerBox!');
    expect(t('common.questionProgress', {current: 2, total: 5})).toBe('Frage 2/5');
  });

  it('follows the language', () => {
    setActiveLanguage('en');
    expect(t('home.welcome', {name: 'BuzzerBox'})).toBe('Welcome to BuzzerBox!');
  });

  it('returns an unknown key and leaves a missing parameter as it is', () => {
    expect(t('no.such.key')).toBe('no.such.key');
    expect(t('home.welcome')).toBe('Willkommen bei {{name}}!');
  });

  it('chooses the form of a text by its number', () => {
    expect(tn('common.points', 1)).toBe('1 Punkt');
    expect(tn('common.points', -1)).toBe('-1 Punkt');
    expect(tn('common.points', 0)).toBe('0 Punkte');
    expect(tn('common.points', 3)).toBe('3 Punkte');
    expect(pluralKey('common.points', 2)).toBe('common.points.other');
    setActiveLanguage('en');
    expect(tn('common.points', 1)).toBe('1 point');
    expect(tn('common.points', 3)).toBe('3 points');
  });
});

describe('LanguageService', () => {
  let service: LanguageService;

  beforeEach(() => {
    localStorage.removeItem('buzzerbox.language');
    service = TestBed.inject(LanguageService);
  });

  afterEach(() => {
    // the other specs check German texts
    service.setLanguage(SPEC_LANGUAGE);
    localStorage.removeItem('buzzerbox.language');
    document.documentElement.lang = LanguageHelper.DEFAULT_LANGUAGE;
  });

  it('starts in the default language, English', () => {
    service.init();
    expect(service.getLanguage()).toBe('en');
    expect(t('common.cancel')).toBe('Cancel');
  });

  it('changes the language of the pipe and of t(), and remembers it', () => {
    service.setLanguage('en');
    expect(service.getLanguage()).toBe('en');
    expect(TestBed.inject(TranslocoService).translate('common.cancel')).toBe('Cancel');
    expect(t('common.cancel')).toBe('Cancel');
    expect(document.documentElement.lang).toBe('en');
    expect(localStorage.getItem('buzzerbox.language')).toBe('en');
  });

  it('starts in the language it remembers', () => {
    localStorage.setItem('buzzerbox.language', 'en');
    service.init();
    expect(service.getLanguage()).toBe('en');
  });

  it('ignores a language it does not know', () => {
    service.setLanguage('de');
    service.setLanguage('fr');
    expect(service.getLanguage()).toBe('de');
    localStorage.setItem('buzzerbox.language', 'fr');
    service.init();
    expect(service.getLanguage()).toBe('en');
  });
});
