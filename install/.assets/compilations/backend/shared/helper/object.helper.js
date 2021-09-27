"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ObjectHelper = void 0;
class ObjectHelper {
    constructor() {
        // hide constructor
    }
    static ensureNotNull(...objects) {
        for (const obj of objects) {
            this.ensureNotNullImpl(obj);
        }
    }
    static ensureNotNullImpl(obj) {
        if (obj === null || obj === undefined) {
            throw new Error("Object is Null but ought not to!");
        }
    }
}
exports.ObjectHelper = ObjectHelper;
//# sourceMappingURL=object.helper.js.map