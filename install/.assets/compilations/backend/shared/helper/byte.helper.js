"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ByteHelper = void 0;
const buffer_1 = require("buffer");
class ByteHelper {
    constructor() {
        // hide constructor
    }
    static assureByte(b) {
        if (b < 0 || 255 < b) {
            throw new Error(`The number "${b}" is not a valid byte!`);
        }
    }
    static assureBytes(...b) {
        for (const b1 of b) {
            this.assureByte(b1);
        }
    }
    static bytesToBuffer(bytes) {
        const b = buffer_1.Buffer.alloc(bytes.length, 0);
        for (let i = 0; i < bytes.length; i++) {
            b[i] = bytes[i].getValue();
        }
        return b;
    }
}
exports.ByteHelper = ByteHelper;
//# sourceMappingURL=byte.helper.js.map