import {environment} from "../env";

export class LoggerService {
    private static forceOverEnvironmentSetting = false;

    public static log(...obj): void {
        if (environment.isDebug || this.forceOverEnvironmentSetting) {
            console.dir(obj)
        }
    }
}
