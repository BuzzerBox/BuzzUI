import http, {Server} from "http";
import {MainExpressService} from "./main-express.service";
import express from "express";
import path from "path";

export class HttpServerService {
    private static instance: HttpServerService;
    // initialize a simple http server
    private server: Server;
    private isStarted: boolean;

    private constructor() {
        this.server = http.createServer(MainExpressService.get().getMain);
        const pathv = path.join(__dirname, 'media');
        console.log('path', pathv)
        MainExpressService.get().getMain().use('/media', express.static(pathv))
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
                console.log(`Server started on port ${port}!`);
            });
            this.isStarted = true;
        }
    }
}
