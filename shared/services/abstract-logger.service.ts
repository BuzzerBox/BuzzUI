import {environment} from "../../server/env";

export abstract class AbstractLoggerService {
    private static forceOverEnvironmentSetting = false;

    public static isDebug(): boolean {
        return false;
    }

    public static log(...obj): void {
        if (this.isDebug() || this.forceOverEnvironmentSetting) {
            this.printTime();
            console.dir(obj);
        }
    }

    public static error(...errors): void {
        if (environment.isDebug || this.forceOverEnvironmentSetting) {
            for(const error of errors) {
                this.printTime();
                console.error(error);
            }
        }
    }

    private static printTime(): void {
        console.log(new Date(Date.now()));
    }

    public static warn(...warnings): void {
        if (environment.isDebug || this.forceOverEnvironmentSetting) {
            for(const warning of warnings) {
                this.printTime();
                console.warn(warning);
            }
        }
    }
}
