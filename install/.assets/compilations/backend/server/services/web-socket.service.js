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
exports.WebSocketService = void 0;
const WebSocket = __importStar(require("ws"));
const http_server_service_1 = require("./http-server.service");
const rxjs_1 = require("rxjs");
const web_socket_connection_1 = require("../objects/web-socket-connection");
const shared_1 = require("../../shared/shared");
const logger_service_1 = require("./logger.service");
class WebSocketService {
    constructor() {
        // initialize the WebSocket backend instance
        const server = http_server_service_1.HttpServerService.get().getServer();
        this.webSocketServer = new WebSocket.Server({ server });
        this.isStarted = true;
        this.connections = new Map();
        this.newConnectionEstablishedSubject = new rxjs_1.Subject();
    }
    static get() {
        if (this.instance == null) {
            this.instance = new WebSocketService();
        }
        return this.instance;
    }
    start() {
        console.log('Starting WebSocketServer!');
        if (this.isStarted) {
            this.webSocketServer.on('connection', (ws) => {
                const wsc = new web_socket_connection_1.WebSocketConnection(ws);
                // send some arbitrary message such that the connecting device knows that the connection was successful
                wsc.send({ packetType: shared_1.EPacketTypes.WEBSOCKET_CONNECTION_SUCCESSFUL });
                this.newConnectionEstablishedSubject.next(wsc);
                this.connections.set(ws, wsc);
                // When the connection is closed, remove it from the held array
                ws.on('close', this.onConnectionClose.bind(this));
            });
        }
        return this.newConnectionEstablishedSubject.asObservable();
    }
    send(con, message) {
        if (con != null) {
            con.send(JSON.stringify(message));
        }
    }
    removeConnection(ws) {
        this.connections.delete(ws);
    }
    onConnectionClose(ws) {
        logger_service_1.LoggerService.log("closing websocket connection:", ws);
        this.removeConnection(ws);
    }
}
exports.WebSocketService = WebSocketService;
//# sourceMappingURL=web-socket.service.js.map
