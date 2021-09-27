"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MicroControllerI2CAdapter = void 0;
const i2c_service_1 = require("../../services/i2c.service");
const config_json_1 = __importDefault(require("../../../config.json"));
const byte_helper_1 = require("../../../shared/helper/byte.helper");
class MicroControllerI2CAdapter {
    constructor() {
        // hide constructor
    }
    static isBuzzerLockActive() {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.read();
            // filter out all other 1s (when seen in binary code) and then check if the first bit is a 1
            return (result & this.BITMASK_BUZZER_LOCK) === this.BITMASK_BUZZER_LOCK;
        });
    }
    /**
     * Will return the number of the pressed buttons from 0 - 9. If result is 127, then no button is pressed
     */
    static getPressedBuzzer() {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.read();
            // erase the bit for the buzzer lock to receive the naked number of the buzzer that is pressed
            // return result ^ this.BITMASK_BUZZER_LOCK;
            return result;
        });
    }
    static read() {
        return __awaiter(this, void 0, void 0, function* () {
            return i2c_service_1.I2cService.get().read(this.getBusNumber(), this.getMicroControllerAddress());
        });
    }
    static toInt(s) {
        return parseInt(s, 10);
    }
    static getBusNumber() {
        return this.toInt(config_json_1.default.i2c.busNumber);
    }
    static getMicroControllerAddress() {
        return this.toInt(config_json_1.default.i2c.addresses.microController);
    }
    static write(command, parameter) {
        return __awaiter(this, void 0, void 0, function* () {
            byte_helper_1.ByteHelper.assureByte(command);
            if (parameter != null) {
                byte_helper_1.ByteHelper.assureByte(parameter);
            }
            yield i2c_service_1.I2cService.get().write(this.getBusNumber(), this.getMicroControllerAddress(), command, parameter != null ? parameter : 0);
        });
    }
    static releaseBuzzerLock() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.write(this.toInt(config_json_1.default.i2c.commands.softRelease));
        });
    }
    static setBuzzerPressed(buzzer) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.write(this.toInt(config_json_1.default.i2c.commands.setBuzzer), buzzer);
        });
    }
}
exports.MicroControllerI2CAdapter = MicroControllerI2CAdapter;
MicroControllerI2CAdapter.BITMASK_BUZZER_LOCK = 0b10000000; // 128
MicroControllerI2CAdapter.VALUE_IDLE_SITUATION = 127;
MicroControllerI2CAdapter.VALUE_BUZZER_0 = 0;
MicroControllerI2CAdapter.VALUE_BUZZER_1 = 1;
MicroControllerI2CAdapter.VALUE_BUZZER_2 = 2;
MicroControllerI2CAdapter.VALUE_BUZZER_3 = 3;
MicroControllerI2CAdapter.VALUE_BUZZER_4 = 4;
MicroControllerI2CAdapter.VALUE_BUZZER_5 = 5;
MicroControllerI2CAdapter.VALUE_BUZZER_6 = 6;
MicroControllerI2CAdapter.VALUE_BUZZER_7 = 7;
MicroControllerI2CAdapter.VALUE_BUZZER_8 = 8;
MicroControllerI2CAdapter.VALUE_BUZZER_9 = 9;
//# sourceMappingURL=MicroControllerI2C.adapter.js.map