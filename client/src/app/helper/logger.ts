import {AbstractLoggerService} from '../../../../shared/services/abstract-logger.service';
import {ConfigService} from '../services/config.service';

export class Logger extends AbstractLoggerService {
  private constructor() {
    super();
  }

  public static isDebug(): boolean {
    return ConfigService.isDevMode();
  }
}
