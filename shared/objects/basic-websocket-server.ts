import {WebSocketServer, WebSocket, Server, RawData} from 'ws';
import {Observable, Subject, Subscription} from 'rxjs';
import {IncomingMessage} from 'http';
import {WebsocketConnection} from './websocket-connection';
import {IOnConnectionCloseValues, IOnNewConnectionValues, IWebsocketClientSendOptions} from '../interfaces/IWebsocket';
import {ArrayHelper} from '../helper/array.helper';

export class BasicWebsocketServer {
    private readonly _webSocketServer: WebSocketServer = null;
    private readonly webSocketConnections: Set<WebsocketConnection> = new Set<WebsocketConnection>();

    private onNewConnectionSubject: Subject<IOnNewConnectionValues> = null;
    private onNewConnectionSubscriptions: Subscription[] = [];
    private onConnectionCloseSubject: Subject<IOnConnectionCloseValues> = null;
    private onConnectionCloseSubscriptions: Subscription[] = [];

    constructor(port: number) {
        this._webSocketServer = new WebSocketServer({port});

        this.onNewConnectionCb(socket => this.webSocketConnections.add(socket));

        this.onConnectionCloseCb(() => this.syncClientObjects());
    }

    public onNewConnection(): Observable<IOnNewConnectionValues> {
        if (this.onNewConnectionSubject == null) {
            this.onNewConnectionSubject = new Subject<IOnNewConnectionValues>();
            this._webSocketServer.on('connection', (socket, request) => this.onNewConnectionSubject.next({
                socket: new WebsocketConnection(socket),
                request
            }));
        }

        return this.onNewConnectionSubject.asObservable();
    }

    public onNewConnectionCb(cb: (socket?: WebsocketConnection, request?: IncomingMessage) => void): void {
        this.onNewConnectionSubscriptions.push(
          this.onNewConnection().subscribe(value => cb(value.socket, value.request))
        );
    }

    // TODO is there a memory leak here? Code feels exactly like that
    public onConnectionClose(): Observable<IOnConnectionCloseValues> {
        if (this.onConnectionCloseSubject == null) {
            this.onConnectionCloseSubject = new Subject<IOnConnectionCloseValues>();
            this._webSocketServer.on('close', (server: Server) => this.onConnectionCloseSubject.next({
                server: this
            }));
        }

        return this.onConnectionCloseSubject.asObservable();
    }

    public onConnectionCloseCb(cb: (server?: BasicWebsocketServer) => void): void {
        this.onConnectionCloseSubscriptions.push(
          this.onConnectionClose().subscribe(value => cb(value.server))
        );
    }

    public broadcast(data: RawData, excludeConnection: WebsocketConnection | WebsocketConnection[] = [], options?: IWebsocketClientSendOptions): void {
        let excluded: WebsocketConnection[] = ArrayHelper.isArray(excludeConnection)
          ? excludeConnection as WebsocketConnection[]
          : [excludeConnection as WebsocketConnection];

        this.webSocketConnections.forEach(client => {
            if (!excluded.includes(client) && client.readyState === WebSocket.OPEN) {
                client.send(data, options);
            }
        })
    }

    public getClients(): Set<WebsocketConnection> {
        return this.webSocketConnections;
    }

    // @ts-ignore
    get clients(): Set<WebsocketConnection> {
        return this.getClients(); //
    }

    public getUnderlyingServerObject(): WebSocketServer {
        return this._webSocketServer;
    }

    private syncClientObjects(): void {
        this.webSocketConnections.forEach(wrappedClient => {
            if (!wrappedClient.areYouInSetOfClientObjects(this._webSocketServer.clients)) {
                this.webSocketConnections.delete(wrappedClient);
            }
        });

        // for (const wrappedClient of this.webSocketConnections) {
        //     if (!wrappedClient.areYouInSetOfClientObjects(this._webSocketServer.clients)) {
        //         this.webSocketConnections.delete(wrappedClient);
        //     }
        // }

        this._webSocketServer.clients.forEach(originalClient => {
            let pendantFound = false;
            this.webSocketConnections.forEach(wrappedClient => {
                if (wrappedClient.isThisYou(originalClient)) {
                    pendantFound = true;
                }
            });
            if (!pendantFound) {
                this._webSocketServer.clients.delete(originalClient);
            }
        });

        // for (const originalClient of this._webSocketServer.clients) {
        //     let pendantFound = false;
        //     for (const wrappedClient of this.webSocketConnections) {
        //         if (wrappedClient.isThisYou(originalClient)) {
        //             pendantFound = true;
        //         }
        //     }
        //     if (!pendantFound) {
        //         this._webSocketServer.clients.delete(originalClient);
        //     }
        // }
    }
}
