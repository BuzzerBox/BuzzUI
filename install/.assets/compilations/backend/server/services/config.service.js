"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigService = void 0;
const process_arguments_service_1 = require("./process-arguments.service");
const config_json_1 = __importDefault(require("../../config.json"));
const config_dev_json_1 = __importDefault(require("../../config.dev.json"));
const _ = __importStar(require("lodash"));
class ConfigService {
    constructor() {
        // hide public constructor
    }
    static getInstance() {
        if (this.instance == null) {
            this.instance = new ConfigService();
        }
        return this.instance;
    }
    /**
     * Get the config dependent on the running mode
     */
    static getConfig() {
        if (this.getInstance().isDevMode()) {
            return _.defaultsDeep(config_dev_json_1.default, config_json_1.default);
        }
        else {
            return config_json_1.default;
        }
    }
    /**
     * An alias for getConfig()
     * @see getConfig
     */
    static get() {
        return this.getConfig();
    }
    isDevMode() {
        console.log("asdasdasd");
        return process_arguments_service_1.ProcessArgumentsService.getArgVal(process_arguments_service_1.EProcessArguments.ENABLE_DEV_MODE) === '1';
    }
    static isDevMode() {
        return this.getInstance().isDevMode();
    }
}
exports.ConfigService = ConfigService;
//# sourceMappingURL=config.service.js.map