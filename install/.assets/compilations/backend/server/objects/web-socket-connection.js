"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketConnection = void 0;
const web_socket_service_1 = require("../services/web-socket.service");
const Uuid = __importStar(require("uuid"));
const rxjs_1 = require("rxjs");
const logger_service_1 = require("../services/logger.service");
class WebSocketConnection {
    constructor(ws) {
        this.webSocketConnection = ws;
        this.wss = web_socket_service_1.WebSocketService.get();
        this.onMessageSubject = new rxjs_1.Subject();
        // connection is up, let's add a simple simple event
        ws.on('message', m => {
            logger_service_1.LoggerService.log(`Received packet: ${m}`);
            this.onMessageSubject.next(JSON.parse(m));
        });
        ws.on('close', this.onClose.bind(this));
        this.uuid = Uuid.v4();
        this.onCloseCallbacks = [];
    }
    send(message) {
        this.wss.send(this.webSocketConnection, message);
    }
    onMessage() {
        return this.onMessageSubject.asObservable();
    }
    getUuid() {
        return this.uuid;
    }
    addOnCloseCallback(onCloseCallback) {
        this.onCloseCallbacks.push(onCloseCallback);
    }
    onClose() {
        for (const cb of this.onCloseCallbacks) {
            cb();
        }
        this.onCloseCallbacks = null;
        this.wss = null;
        this.webSocketConnection = null;
    }
    close() {
        this.webSocketConnection.close();
    }
}
exports.WebSocketConnection = WebSocketConnection;
//# sourceMappingURL=web-socket-connection.js.map