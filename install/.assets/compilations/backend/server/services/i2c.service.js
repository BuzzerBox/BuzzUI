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
Object.defineProperty(exports, "__esModule", { value: true });
exports.I2cService = void 0;
const i2c_bus_1 = require("i2c-bus");
const byte_helper_1 = require("../../shared/helper/byte.helper");
class I2cService {
    constructor() {
        //
    }
    static get() {
        if (this.instance == null) {
            this.instance = new I2cService();
        }
        return this.instance;
    }
    test2() {
        this.read(1, 0x19).then(console.log).catch(console.log);
    }
    read(busNumber, address) {
        return __awaiter(this, void 0, void 0, function* () {
            byte_helper_1.ByteHelper.assureBytes(busNumber, address);
            const resultBuffer = Buffer.alloc(1);
            const promisifiedBus = yield i2c_bus_1.openPromisified(busNumber);
            const readBytes = yield promisifiedBus.i2cRead(address, resultBuffer.length, resultBuffer);
            console.log("plain", parseInt(readBytes.buffer.toString('hex'), 16));
            return parseInt(readBytes.buffer.toString('hex'), 16);
        });
    }
    write(busNumber, address, command, byte) {
        return __awaiter(this, void 0, void 0, function* () {
            byte_helper_1.ByteHelper.assureBytes(busNumber, address, command, byte);
            const promisifiedBus = yield i2c_bus_1.openPromisified(busNumber);
            yield promisifiedBus.writeByte(address, command, byte);
        });
    }
}
exports.I2cService = I2cService;
//# sourceMappingURL=i2c.service.js.map