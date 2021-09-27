"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EProcessArguments = exports.ProcessArgumentsService = void 0;
const logger_service_1 = require("./logger.service");
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["LOG"] = 0] = "LOG";
    LogLevel[LogLevel["WARN"] = 1] = "WARN";
    LogLevel[LogLevel["ERROR"] = 2] = "ERROR";
})(LogLevel || (LogLevel = {}));
class ProcessArgumentsService {
    constructor() {
        this.logQueue = [];
        this.passedArgumentsMap = new Map();
        console.log("process.argv", process.argv);
        process.argv.forEach((rawArgToProcess) => {
            this.addLog("Got raw argument for backend process:", rawArgToProcess);
            if (rawArgToProcess != null && rawArgToProcess.substr(0, ProcessArgumentsService.prefixArguments.length) === ProcessArgumentsService.prefixArguments) {
                const tmpArg = rawArgToProcess.substr(ProcessArgumentsService.prefixArguments.length);
                if (tmpArg.includes('=')) {
                    // in this case, the arg passed was something like "--dev=0"
                    const split = tmpArg.split('=');
                    const arg = EProcessArguments.fromStringRepresentation(split[0]);
                    if (arg != null) {
                        const value = split[1];
                        this.passedArgumentsMap.set(arg, value);
                        this.addLog(`Found process arg '${arg}' with value '${value}' that is supported`);
                    }
                }
                else {
                    // in this case, the arg passed was something like "--dev" which will be interpreted as true since it is explicitly passed
                    const arg = EProcessArguments.fromStringRepresentation(tmpArg);
                    if (arg != null && EProcessArguments.isArgumentWithoutValueSupported(arg)) {
                        this.passedArgumentsMap.set(arg, '1');
                    }
                    else {
                        this.addWarnLog(`Found process arg ${tmpArg} that is either unknown or needs a value assigned to it!`);
                    }
                }
            }
        });
    }
    static get() {
        if (this.instance == null) {
            this.instance = new ProcessArgumentsService();
            this.instance.processLogQueue();
        }
        return this.instance;
    }
    static getArgVal(arg) {
        return this.get().passedArgumentsMap.get(arg);
    }
    addLog(...obj) {
        this.addToLogQueue(LogLevel.LOG, obj);
    }
    addWarnLog(...obj) {
        this.addToLogQueue(LogLevel.WARN, obj);
    }
    addToLogQueue(level, ...obj) {
        for (const o of obj) {
            this.logQueue.push({ level, content: o });
        }
    }
    processLogQueue() {
        while (this.logQueue.length > 0) {
            const entry = this.logQueue.shift();
            switch (entry.level) {
                case LogLevel.WARN:
                    logger_service_1.LoggerService.warn(entry.content);
                    break;
                case LogLevel.ERROR:
                    logger_service_1.LoggerService.error(entry.content);
                    break;
                case LogLevel.LOG:
                default:
                    logger_service_1.LoggerService.log(entry.content);
                    break;
            }
        }
    }
}
exports.ProcessArgumentsService = ProcessArgumentsService;
ProcessArgumentsService.prefixArguments = '--';
// tslint:disable-next-line:max-classes-per-file
class EProcessArguments {
    constructor(stringRepresentation) {
        this.stringRepresentation = stringRepresentation;
    }
    static fromStringRepresentation(stringRepresentation) {
        switch (stringRepresentation) {
            case EProcessArguments.ENABLE_DEV_MODE.toString():
                return EProcessArguments.ENABLE_DEV_MODE;
            default:
                return null;
        }
    }
    toString() {
        return this.stringRepresentation;
    }
    static isArgumentWithoutValueSupported(arg) {
        return this.isArgOneOf(arg, [EProcessArguments.ENABLE_DEV_MODE]);
    }
    static isArgOneOf(arg, oneOf) {
        return oneOf.includes(arg);
    }
}
exports.EProcessArguments = EProcessArguments;
EProcessArguments.ENABLE_DEV_MODE = new EProcessArguments('dev');
//# sourceMappingURL=process-arguments.service.js.map
