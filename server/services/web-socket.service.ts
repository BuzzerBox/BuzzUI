import * as WebSocket from "ws";
import {HttpServerService} from "./http-server.service";
import {Observable, Subject} from "rxjs";
import {WebSocketConnection} from "../objects/web-socket-connection";
import {EPacketTypes, IGamePacket, IWebSocketMessage} from '../../shared/shared';
import {AbstractLoggerService} from "../../shared/services/abstract-logger.service";
import {LoggerService} from './logger.service';

export class WebSocketService {
    private static instance: WebSocketService;
    private webSocketServer: WebSocket.Server;
    private newConnectionEstablishedSubject: Subject<WebSocketConnection>;
    private static readonly HEARTBEAT_INTERVAL_IN_MS = 10000;
    private connections: Map<WebSocket, WebSocketConnection>;
    // connections that answered the last ping
    private aliveConnections = new Set<WebSocket>();
    private isStarted: boolean;

    private constructor() {
        // initialize the WebSocket server instance
        const server = HttpServerService.get().getServer();
        this.webSocketServer = new WebSocket.Server({ server });
        this.isStarted = true;
        this.connections = new Map<WebSocket, WebSocketConnection>();
        this.newConnectionEstablishedSubject = new Subject<WebSocketConnection>();
        setInterval(() => this.checkConnectionsAlive(), WebSocketService.HEARTBEAT_INTERVAL_IN_MS);
    }

    /**
     * A device that drops off the WiFi does not close its connection. Without noticing, a master would stay registered
     * and the same device could not register again after reconnecting. So every connection has to answer a ping (which
     * browsers do on their own) until the next check, or it gets closed.
     */
    private checkConnectionsAlive(): void {
        this.webSocketServer.clients.forEach((ws: WebSocket) => {
            if (!this.aliveConnections.has(ws)) {
                LoggerService.warn("closing websocket connection that did not answer the last ping");
                ws.terminate();
                return;
            }
            this.aliveConnections.delete(ws);
            ws.ping();
        });
    }

    public static get(): WebSocketService {
        if (this.instance == null) {
            this.instance = new WebSocketService();
        }
        return this.instance;
    }

    public start(): Observable<WebSocketConnection> {
        console.log('Starting WebSocketServer!')
        if (this.isStarted) {
            this.webSocketServer.on('connection', (ws: WebSocket) => {
                const wsc: WebSocketConnection = new WebSocketConnection(ws);
                // send some arbitrary message such that the connecting device knows that the connection was successful
                wsc.send<IGamePacket>({packetType: EPacketTypes.WEBSOCKET_CONNECTION_SUCCESSFUL})
                this.newConnectionEstablishedSubject.next(wsc);
                this.connections.set(ws, wsc);

                // When the connection is closed, remove it from the held array
                ws.on('close', () => this.onConnectionClose(ws));
                this.aliveConnections.add(ws);
                ws.on('pong', () => this.aliveConnections.add(ws));
            });
        }
        return this.newConnectionEstablishedSubject.asObservable();
    }

    public send(con: WebSocket, message: IWebSocketMessage): void {
        if (con != null) {
            con.send(JSON.stringify(message));
        }
    }

    private removeConnection(ws: WebSocket) {
        this.connections.delete(ws);
        this.aliveConnections.delete(ws);
    }

    private onConnectionClose(ws: WebSocket): void {
        LoggerService.log("closing websocket connection");
        this.removeConnection(ws);
    }
}
