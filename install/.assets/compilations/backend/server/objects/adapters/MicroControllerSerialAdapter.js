"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MicroControllerSerialAdapter = void 0;
const serial_port_service_1 = require("../../services/serial-port.service");
const config_service_1 = require("../../services/config.service");
const byte_1 = require("../../../shared/objects/byte");
class MicroControllerSerialAdapter {
    constructor() {
        // hide public constructor
    }
    static sendCommand(command, parameter) {
        const arrayOfBytes = [];
        if (command instanceof byte_1.Byte) {
            arrayOfBytes.push(command);
        }
        else {
            arrayOfBytes.push(new byte_1.Byte(command));
        }
        if (parameter != null) {
            if (parameter instanceof byte_1.Byte) {
                arrayOfBytes.push(parameter);
            }
            else {
                arrayOfBytes.push(new byte_1.Byte(parameter));
            }
        }
        else {
            arrayOfBytes.push(new byte_1.Byte(config_service_1.ConfigService.get().serial.stuffingBit));
        }
        arrayOfBytes.push(new byte_1.Byte(config_service_1.ConfigService.get().serial.eol));
        serial_port_service_1.SerialPortService.get().writeBytes(arrayOfBytes);
    }
    static sendSerialCommandReleaseLock() {
        this.sendCommand(config_service_1.ConfigService.get().serial.commands.softRelease);
    }
    static sendSerialCommandSetBuzzer(buzzerNumber) {
        this.sendCommand(config_service_1.ConfigService.get().serial.commands.setBuzzer, buzzerNumber);
    }
}
exports.MicroControllerSerialAdapter = MicroControllerSerialAdapter;
//# sourceMappingURL=MicroControllerSerialAdapter.js.map