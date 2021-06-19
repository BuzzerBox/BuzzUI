import * as WebSocket from "ws";
import {Server} from "ws";
import {HttpServerService} from "./http-server.service";
import {Observable, Subject} from "rxjs";
import {WebSocketConnection} from "../objects/web-socket-connection";
import {IWebSocketMessage} from '../../shared/shared';
import {LoggerService} from "./logger.service";

export class WebSocketService {
    private static instance: WebSocketService;
    private webSocketServer: Server;
    private newConnectionEstablishedSubject: Subject<WebSocketConnection>;
    private connections: Map<WebSocket, WebSocketConnection>;
    private isStarted: boolean;

    private constructor() {
        //initialize the WebSocket server instance
        let server = HttpServerService.get().getServer();
        this.webSocketServer = new WebSocket.Server({ server });
        this.isStarted = true;
        this.connections = new Map<WebSocket, WebSocketConnection>();
        this.newConnectionEstablishedSubject = new Subject<WebSocketConnection>();
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
                this.newConnectionEstablishedSubject.next(wsc);
                this.connections.set(ws, wsc);



                //connection is up, let's add a simple simple event
                // ws.on('message', this.onMessage.bind(this));

                // When the connection is closed, remove it from the held array
                ws.on('close', this.onConnectionClose.bind(this));
                // ws.on('error', () => this.removeConnection(ws));
            });
        }
        return this.newConnectionEstablishedSubject.asObservable();
    }

    /*private onMessage(message: string): void {
        //log the received message and send it back to the client
        console.log('received via web socket: %s', message);
    }*/

    public send(con: WebSocket, message: IWebSocketMessage): void {
        if (con != null) {
            con.send(JSON.stringify(message));
        }
    }

    private removeConnection(ws: WebSocket) {
        this.connections.delete(ws);
    }

    private onConnectionClose(ws: WebSocket): void {
        LoggerService.log("closing websocket connection:", ws);
        this.removeConnection(ws);
    }
}
