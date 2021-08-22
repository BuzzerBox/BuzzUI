import {AbstractLoggerService} from '../../shared/services/abstract-logger.service';
import {ConfigService} from './config.service';

export class LoggerService extends AbstractLoggerService {
  private constructor() {
    super();
  }

  public static isDebug(): boolean {
    return ConfigService.isDevMode();
  }
}
