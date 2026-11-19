import { enableProdMode, provideZoneChangeDetection } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';

import { AppModule } from './app/app.module';
import { environment } from './environments/environment';
import { KioskHelper } from './app/helper/kiosk.helper';

if (environment.production) {
  enableProdMode();
}

// before Angular routes: the URL only has its flag until then
KioskHelper.apply();

platformBrowserDynamic().bootstrapModule(AppModule, { applicationProviders: [provideZoneChangeDetection()], })
  .catch(err => console.error(err));
