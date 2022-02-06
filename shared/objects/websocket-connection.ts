import {RawData, WebSocket} from 'ws';
import {Observable, Subject, Subscription} from 'rxjs';
import {Buffer} from 'buffer';
import {
    IOnCloseReturnValues,
    IOnErrorReturnValues,
    IOnMessageReturnValues,
    IWebsocketClientSendOptions
} from '../interfaces/IWebsocket';

// found in @types/websocket
export type ReadyState = | typeof WebSocket.CONNECTING
  | typeof WebSocket.OPEN
  | typeof WebSocket.CLOSING
  | typeof WebSocket.CLOSED;

export enum EReadyState {
    CONNECTING = WebSocket.CONNECTING,
    OPEN = WebSocket.OPEN,
    CLOSING = WebSocket.CLOSING,
    CLOSED = WebSocket.CLOSED,
}

// TODO maybe let it extend from the original object WebSocket?
export class WebsocketConnection {
    private readonly _websocket: WebSocket = null;
    private onOpenPromise: Promise<void> = null;
    private onErrorSubject: Subject<IOnErrorReturnValues> = null;
    private onErrorSubscriptions: Subscription[] = [];
    private onClosePromise: Promise<IOnCloseReturnValues> = null;
    private onMessageSubject: Subject<IOnMessageReturnValues> = null;
    private onMessageSubscriptions: Subscription[] = [];

    constructor(websocket: WebSocket) {
        this._websocket = websocket;
    }

    public onOpen(): Promise<void> {
        if (this.onOpenPromise == null) {
            this.onOpenPromise = new Promise<void>(resolve => this._websocket.once("open", () => resolve()))
        }

        return this.onOpenPromise;
    }

    public onClose(): Promise<IOnCloseReturnValues> {
        if (this.onClosePromise == null) {
            this.onClosePromise = new Promise<IOnCloseReturnValues>(
              resolve => this._websocket.once('close', (code, reason) => resolve({connection: this, code, reason}))
            );
        }

        return this.onClosePromise;
    }

    public onMessage(): Observable<IOnMessageReturnValues> {
        if (this.onMessageSubject == null) {
            this.onMessageSubject = new Subject<IOnMessageReturnValues>();
            // this._websocket.on('message', (data, isBinary) => this.onMessageSubject.next({
            //     connection: this,
            //     data,
            //     isBinary
            // }));
            this._websocket.on('message', (data, isBinary) => {
                this.onMessageSubject.next({
                    connection: this,
                    data,
                    isBinary
                })
            });
        }

        return this.onMessageSubject.asObservable();
    }

    public onError(): Observable<IOnErrorReturnValues> {
        if (this.onErrorSubject == null) {
            this.onErrorSubject = new Subject<IOnErrorReturnValues>()
            this._websocket.on('error', err => this.onErrorSubject.next({error: err}));
        }

        return this.onErrorSubject.asObservable();
    }

    public send(data: RawData | string | Object, options?: IWebsocketClientSendOptions): void {
        this._websocket.send(data, options);
    }

    public onOpenCb(cb: () => void): void {
        this.onOpen().then(() => cb());
    }

    public onCloseCb(cb: (con: WebsocketConnection, code?: number, reason?: Buffer) => void): void {
        this.onClose().then(value => cb(value.connection, value.code, value.reason));
    }

    public onErrorCb(cb: (err?: Error) => void): void {
        this.onErrorSubscriptions.push(
          this.onError().subscribe(value => cb(value.error))
        );
    }

    public onMessageCb(cb: (con: WebsocketConnection, data: RawData, isBinary?: boolean) => void): void {
        this.onMessageSubscriptions.push(
          this.onMessage().subscribe(value => cb(value.connection, value.data, value.isBinary))
        );
    }

    public static connect(
      hostname: string,
      port: number,
      protocol: "ws" | "wss" = 'ws'
    ): WebsocketConnection {
        return new WebsocketConnection(this.connectImpl(hostname, port, protocol));
    }

    // TODO impl something for the case that the connection could not be established
    private static connectImpl(
      hostname: string,
      port: number,
      protocol: "ws" | "wss" = 'ws'
    ): WebSocket {
        return new WebSocket(`${protocol}://${hostname}:${port}`);
    }

    public isThisYou(ws: WebSocket): boolean {
        return this._websocket === ws;
    }

    public areYouInSetOfClientObjects(clients: Set<WebSocket>): boolean {
        clients.forEach(client => {
            if (client === this._websocket) {
                return true;
            }
        })
        return false;
    }

    public static readyStateToEnum(readyState: ReadyState): EReadyState {
        switch (readyState) {
            case 0:
                return EReadyState.CONNECTING;
            case 1:
                return EReadyState.OPEN;
            case 2:
                return EReadyState.CLOSING;
            case 3:
                return EReadyState.CLOSED;
            default:
                return null;
        }
    }

    public getReadyStateAsEnum(): EReadyState {
        return WebsocketConnection.readyStateToEnum(this.readyState);
    }

    get readyState(): ReadyState {
        return this._websocket.readyState;
    }

    // TODO impl attempts here or in the connectImpl
    public reconnect(/*delayBetweenAttemptsInSeconds: number = 5, numberOfAttemptsBeforeFailing: number = 3*/): Promise<void> {
        return new Promise((resolve, reject) => {
            // const reconnectionAttempt
            // let attemptsLeft = numberOfAttemptsBeforeFailing;

            // if connections is still open, close it gracefully
            if (this.getReadyStateAsEnum() === EReadyState.OPEN) {
                this._websocket.close();
            }
        })
    }

    private addHandlersToNewConnectionObject(): void {}
}
