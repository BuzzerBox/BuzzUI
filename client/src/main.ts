import { enableProdMode, provideZoneChangeDetection } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';
import { environment } from './environments/environment';
import { KioskHelper } from './app/helper/kiosk.helper';
import { registerClientExtensions } from './app/extensions/extensions';

if (environment.production) {
  enableProdMode();
}

// their box settings and texts, which Angular's parts read
registerClientExtensions();

// before Angular routes: the URL only has its flag until then
KioskHelper.apply();

platformBrowserDynamic().bootstrapModule(AppModule, { applicationProviders: [provideZoneChangeDetection()], })
  .catch(err => console.error(err));
