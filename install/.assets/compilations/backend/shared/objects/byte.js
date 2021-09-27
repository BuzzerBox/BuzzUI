"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Byte = void 0;
const byte_helper_1 = require("../helper/byte.helper");
class Byte {
    constructor(value) {
        if (typeof value === 'string') {
            if (isNaN(Number(value))) {
                // In this case, it is a string that can't be converted to a number
                throw Error(`The value >${value}< can't be converted to a number`);
            }
            else {
                const x = parseInt(value);
                byte_helper_1.ByteHelper.assureByte(x);
                this.value = x;
            }
        }
        else {
            byte_helper_1.ByteHelper.assureByte(value);
            this.value = value;
        }
    }
    getValue() {
        return this.value;
    }
    static from(origin) {
        const result = [];
        for (const n of origin) {
            result.push(new Byte(n));
        }
        return result;
    }
}
exports.Byte = Byte;
//# sourceMappingURL=byte.js.map