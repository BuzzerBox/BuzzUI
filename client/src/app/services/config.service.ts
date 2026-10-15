import {Injectable, isDevMode} from '@angular/core';
import config from '../../../../config.json';
import configDev from '../../../../config.dev.json';
import { defaultsDeep } from 'lodash-es';

@Injectable({
  providedIn: 'root'
})
export class ConfigService {

  private constructor() {}

  /**
   * Get the config dependent on the running mode
   */
  public static getConfig(): typeof config {
    if (isDevMode()) {
      return defaultsDeep(configDev, config);
    } else {
      return config;
    }
  }

  /**
   * An alias for getConfig()
   * @see getConfig
   */
  public static get(): typeof config {
    return this.getConfig();
  }

  /**
   * The host of the game server. If the config leaves it empty, it's the host this page was loaded from, so the app
   * keeps working when the server's IP address or hostname changes.
   */
  public static getServerAddress(): string {
    return this.get().server.address || window.location.hostname;
  }

  public static isDevMode(): boolean {
    return isDevMode();
  }
}
