"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoggerService = void 0;
const abstract_logger_service_1 = require("../../shared/services/abstract-logger.service");
const config_service_1 = require("./config.service");
class LoggerService extends abstract_logger_service_1.AbstractLoggerService {
    constructor() {
        super();
    }
    static isDebug() {
        return config_service_1.ConfigService.isDevMode();
    }
}
exports.LoggerService = LoggerService;
//# sourceMappingURL=logger.service.js.map