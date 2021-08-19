import {Injectable, isDevMode} from '@angular/core';
import config from '../../../../config.json';
import configDev from '../../../../config.dev.json';
import * as _ from 'lodash';

@Injectable({
  providedIn: 'root'
})
export class ConfigService {

  private constructor() {}

  /**
   * Get the config dependent on the running mode
   */
  public getConfig(): typeof config {
    if (isDevMode()) {
      return _.defaultsDeep(configDev, config);
    } else {
      return config;
    }
  }

  /**
   * An alias for getConfig()
   * @see getConfig
   */
  public get(): typeof config {
    return this.getConfig();
  }
}
