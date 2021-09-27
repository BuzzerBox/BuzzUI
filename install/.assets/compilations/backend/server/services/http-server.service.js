"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpServerService = void 0;
const http_1 = __importDefault(require("http"));
const main_express_service_1 = require("./main-express.service");
class HttpServerService {
    constructor() {
        this.server = http_1.default.createServer(main_express_service_1.MainExpressService.get().getMain);
        this.isStarted = false;
    }
    static get() {
        if (this.instance == null) {
            this.instance = new HttpServerService();
        }
        return this.instance;
    }
    getServer() {
        return this.server;
    }
    start(port) {
        // start our backend
        if (!this.isStarted) {
            this.server.listen(port, () => {
                console.log(`Server started on port ${port}!`);
            });
            this.isStarted = true;
        }
    }
}
exports.HttpServerService = HttpServerService;
//# sourceMappingURL=http-backend.service.js.map
