import {environment} from '../../environments/environment';

export class Logger {
  public static log(...obj): void {
    if (!environment.production) {
        console.dir(obj);
    }
  }
}
