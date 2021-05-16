import * as WebSocket from "ws";
import {WebSocketService} from "../services/web-socket.service";
import * as Uuid from 'uuid';
import {Observable, Subject} from "rxjs";
import {LoggerService} from "../services/logger.service";
import {IGamePacket, IWebSocketMessage} from "../../shared/objects/shared";
import {IDestroyCallback} from "./interfaces/IDestroyCallback";

type onDestroyCallback = () => void;

export class WebSocketConnection {
    private webSocketConnection: WebSocket;
    private wss: WebSocketService;
    private uuid: string;
    private onMessageSubject: Subject<IGamePacket>;
    private onCloseCallbacks: onDestroyCallback[];

    constructor(ws: WebSocket) {
        this.webSocketConnection = ws;
        this.wss = WebSocketService.get();
        this.onMessageSubject = new Subject<IGamePacket>();
        //connection is up, let's add a simple simple event
        ws.on('message', m => {
            LoggerService.log(`Received packet: ${m}`);
            this.onMessageSubject.next(JSON.parse(m as string));
        });
        ws.on('close', this.onClose.bind(this));
        this.uuid = Uuid.v4()
        this.onCloseCallbacks = [];
    }

    public send<T extends IWebSocketMessage>(message: T): void {
        this.wss.send(this.webSocketConnection, message);
    }

    public onMessage(): Observable<IGamePacket> {
        return this.onMessageSubject.asObservable();
    }

    public getUuid(): string {
        return this.uuid;
    }

    public addOnCloseCallback(onCloseCallback: onDestroyCallback): void {
        this.onCloseCallbacks.push(onCloseCallback);
    }

    private onClose(): void {
        for (let cb of this.onCloseCallbacks) {
            cb();
        }
        this.onCloseCallbacks = null;
        this.wss = null;
        this.webSocketConnection = null;
    }

    public close(): void {
        this.webSocketConnection.close();
    }
}
