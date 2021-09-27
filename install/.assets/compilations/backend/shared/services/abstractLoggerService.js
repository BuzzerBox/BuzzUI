"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AbstractLoggerService = void 0;
const env_1 = require("../../server/env");
class AbstractLoggerService {
    static isDebug() {
        return true;
    }
    static log(...obj) {
        this.printTime();
        if (this.isDebug() || this.forceOverEnvironmentSetting) {
            console.dir(obj);
        }
    }
    static error(...errors) {
        this.printTime();
        if (env_1.environment.isDebug || this.forceOverEnvironmentSetting) {
            for (const error of errors) {
                console.error(error);
            }
        }
    }
    static printTime() {
        console.log(new Date(Date.now()));
    }
    static warn(...warnings) {
        this.printTime();
        if (env_1.environment.isDebug || this.forceOverEnvironmentSetting) {
            for (const warning of warnings) {
                console.warn(warning);
            }
        }
    }
}
exports.AbstractLoggerService = AbstractLoggerService;
AbstractLoggerService.forceOverEnvironmentSetting = false;
//# sourceMappingURL=abstractLoggerService.js.map