import {environment} from "../env";

export class LoggerService {
    private static forceOverEnvironmentSetting = false;

    public static log(...obj): void {
        if (environment.isDebug || this.forceOverEnvironmentSetting) {
            console.dir(obj)
        }
    }

    public static error(...errors): void {
        if (environment.isDebug || this.forceOverEnvironmentSetting) {
            for(const error of errors) {
                console.error(error)
            }
        }
    }
}
