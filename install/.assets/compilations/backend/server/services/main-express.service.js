"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MainExpressService = void 0;
const express_1 = __importDefault(require("express"));
class MainExpressService {
    constructor() {
        this.main = express_1.default();
    }
    static get() {
        if (this.instance == null) {
            this.instance = new MainExpressService();
        }
        return this.instance;
    }
    getMain() {
        return this.main;
    }
}
exports.MainExpressService = MainExpressService;
//# sourceMappingURL=main-express.service.js.map