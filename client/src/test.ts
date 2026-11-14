// This file is required by karma.conf.js and loads recursively all the .spec and framework files

import 'zone.js/testing';
import { getTestBed, TestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting
} from '@angular/platform-browser-dynamic/testing';

import {getI18nTestingModule} from './app/i18n/i18n-testing.module';
import {setActiveLanguage} from './app/i18n/i18n';
import {LanguageHelper} from '../../shared/shared';

// First, initialize the Angular testing environment.
getTestBed().initTestEnvironment(
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting(), {
    teardown: { destroyAfterEach: false }
}
);

// every spec gets the app's texts in the default language, see getI18nTestingModule()
beforeEach(() => {
  setActiveLanguage(LanguageHelper.DEFAULT_LANGUAGE);
  TestBed.configureTestingModule({imports: [getI18nTestingModule()]});
});
