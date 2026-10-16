import http, {Server} from "http";

export class HttpServerService {
    private static instance: HttpServerService;
    // initialize a simple http server
    private server: Server;
    private isStarted: boolean;

    private constructor() {
        // this server only carries the WebSocket connections (see WebSocketService); the media are on their own port
        this.server = http.createServer((req, res) => {
            res.statusCode = 426;
            res.setHeader('Upgrade', 'websocket');
            res.end();
        });
        this.isStarted = false;
    }

    public static get(): HttpServerService {
        if (this.instance == null) {
            this.instance = new HttpServerService();
        }
        return this.instance;
    }

    public getServer(): Server {
        return this.server;
    }

    public start(port: number): void {
        // start our server
        if (!this.isStarted) {
            this.server.listen(port, () => {
                console.log(`Gameserver started on port ${port}!`);
            });
            this.isStarted = true;
        }
    }
}
