// This file is required by karma.conf.js and loads recursively all the .spec and framework files

import 'zone.js/testing';
import { getTestBed, TestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting
} from '@angular/platform-browser-dynamic/testing';

import {getI18nTestingModule, SPEC_LANGUAGE} from './app/i18n/i18n-testing.module';
import {setActiveLanguage} from './app/i18n/i18n';

// First, initialize the Angular testing environment.
getTestBed().initTestEnvironment(
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting(), {
    teardown: { destroyAfterEach: false }
}
);

// every spec gets the app's texts in German, see getI18nTestingModule()
beforeEach(() => {
  setActiveLanguage(SPEC_LANGUAGE);
  TestBed.configureTestingModule({imports: [getI18nTestingModule()]});
});
