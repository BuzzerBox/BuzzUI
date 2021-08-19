import {environment} from "../env";

export class LoggerService {
    private static forceOverEnvironmentSetting = false;

    public static log(...obj): void {
        this.printTime();
        if (environment.isDebug || this.forceOverEnvironmentSetting) {
            console.dir(obj);
        }
    }

    public static error(...errors): void {
        this.printTime();
        if (environment.isDebug || this.forceOverEnvironmentSetting) {
            for(const error of errors) {
                console.error(error);
            }
        }
    }

    private static printTime(): void {
        console.log(new Date(Date.now()));
    }

    public static warn(...warnings): void {
        this.printTime();
        if (environment.isDebug || this.forceOverEnvironmentSetting) {
            for(const warning of warnings) {
                console.warn(warning);
            }
        }
    }
}
