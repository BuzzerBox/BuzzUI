"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SerialPortService = void 0;
const serialport_1 = __importDefault(require("serialport"));
const config_service_1 = require("./config.service");
const logger_service_1 = require("./logger.service");
const byte_helper_1 = require("../../shared/helper/byte.helper");
class SerialPortService {
    constructor() {
        this.onDataInCallbacks = [];
        this.onErrorCallbacks = [];
        this.serialPortConnection = new serialport_1.default(config_service_1.ConfigService.get().serial.address, {
            baudRate: config_service_1.ConfigService.get().serial.baudRate
        });
        this.serialPortConnection.on('error', this.onError.bind(this));
        this.serialPortConnection.on('data', this.onDataIn.bind(this));
    }
    static get() {
        if (this.instance == null) {
            this.instance = new SerialPortService();
        }
        return this.instance;
    }
    addOnDataInCallback(callback) {
        this.onDataInCallbacks.push(callback);
    }
    addOnErrorCallback(callback) {
        this.onErrorCallbacks.push(callback);
    }
    onDataIn(data) {
        for (const callback of this.onDataInCallbacks) {
            callback(data);
        }
    }
    onError(error) {
        logger_service_1.LoggerService.error(error);
        for (const callback of this.onErrorCallbacks) {
            callback(error);
        }
    }
    /**
     * Only accepts Bytes
     * @param bytes
     */
    writeBytes(bytes) {
        this.write(byte_helper_1.ByteHelper.bytesToBuffer(bytes));
    }
    write(buffer) {
        this.serialPortConnection.write(buffer);
    }
}
exports.SerialPortService = SerialPortService;
//# sourceMappingURL=serial-port.service.js.map