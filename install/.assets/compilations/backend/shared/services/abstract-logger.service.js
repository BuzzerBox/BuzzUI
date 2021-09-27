"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AbstractLoggerService = void 0;
const env_1 = require("../../server/env");
class AbstractLoggerService {
    static isDebug() {
        return false;
    }
    static log(...obj) {
        if (this.isDebug() || this.forceOverEnvironmentSetting) {
            this.printTime();
            console.dir(obj);
        }
    }
    static error(...errors) {
        if (env_1.environment.isDebug || this.forceOverEnvironmentSetting) {
            for (const error of errors) {
                this.printTime();
                console.error(error);
            }
        }
    }
    static printTime() {
        console.log(new Date(Date.now()));
    }
    static warn(...warnings) {
        if (env_1.environment.isDebug || this.forceOverEnvironmentSetting) {
            for (const warning of warnings) {
                this.printTime();
                console.warn(warning);
            }
        }
    }
}
exports.AbstractLoggerService = AbstractLoggerService;
AbstractLoggerService.forceOverEnvironmentSetting = false;
//# sourceMappingURL=abstract-logger.service.js.map