import {RawData, WebSocket, WebSocketServer} from 'ws';
import {
    MathHelper,
    ServerConsoleHelper, WebsocketConnection,
    BasicWebsocketServer
} from '../shared/shared';



class StandaloneWebsocketServer {
    private static _instance: StandaloneWebsocketServer = null;
    private webSocketServer: BasicWebsocketServer = null;

    private broadcastIncomingMessages = false;

    private constructor() {
        this._run();
    }

    public static run(): void {
        if (this._instance == null) {
            this._instance = new StandaloneWebsocketServer();
        }
    }

    private _run(): void {
        this.createWebsocketServer();
    }

    private async createWebsocketServer(): Promise<void> {
        ServerConsoleHelper.prompt(
          ServerConsoleHelper.QuestionsMaker.input(
            "hostname",
            "which hostname shall be bound to?",
            "127.0.0.1"
            ),
          ServerConsoleHelper.QuestionsMaker.number(
          'port',
          "What port shall the websocket server listen on? (>= 0 and < 65536)",
          6666,
          (value) => {
              if (MathHelper.isInRangeInclusive(value, 0, 65536)) {
                  return true;
              }
              return 'Please enter a valid port number';
          }),
          ServerConsoleHelper.QuestionsMaker.confirm(
            'broadcastIncomingMessages',
            'Do you want incoming messages to be broadcasted to all clients (except the one that sent it)?',
            false
          )
        ).then(answer => {
              this.broadcastIncomingMessages = answer.broadcastIncomingMessages as boolean;
            if (this.webSocketServer == null) {
                this.webSocketServer = new BasicWebsocketServer(answer.hostname, answer.port);
                this.webSocketServer.onNewConnectionCb(this.onNewConnection.bind(this));
            }
        })
    }

    private onNewConnection(con: WebsocketConnection): void {
        console.log("New client connected")
        con.onMessageCb(this.onMessage.bind(this));
        con.onCloseCb(this.onConnectionClose.bind(this)); //
    }

    private onMessage(con: WebsocketConnection, data: RawData, isBinary: boolean = false): void {
        console.log('received data: %s', data);

        // // check if it can be parsed to JSO
        // let canBeParsedToJSO = true;
        // try {
        //     JSON.parse(data.toString())
        // } catch (error: any) {
        //     canBeParsedToJSO = false;
        // }
        // if (canBeParsedToJSO) {
        //     console.log("The received data can be parsed to JSO:")
        //     console.log(JSON.stringify(data, null, "  "));
        // } else {
        //     console.log("The received data can NOT be parsed to JSO")
        // }

        // redirect the incoming message to all currently active connections
        if (this.broadcastIncomingMessages) {
            this.webSocketServer.broadcast(data, con);
        }
    }

    private onConnectionClose(con: WebsocketConnection, code: number, reason: Buffer): void {
        console.log("A connection was closed with code '%n'. Reason:\n", code);
        console.log(reason);
    }
}

StandaloneWebsocketServer.run();
