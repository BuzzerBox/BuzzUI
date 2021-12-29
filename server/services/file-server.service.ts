import {MainExpressService} from "./main-express.service";
import express from "express";

export class FileServerService {
    private static instance: FileServerService;
    // initialize a static, express file server
    private isStarted: boolean;

    private constructor() {
        this.isStarted = false;
    }

    public static get(): FileServerService {
        if (this.instance == null) {
            this.instance = new FileServerService();
        }
        return this.instance;
    }

    public start(port: number, localPath: string, serverPath: string = '/media'): void {
        // start our server
        if (!this.isStarted) {
            MainExpressService.get().getMain().use(serverPath, express.static(localPath)).listen(port, () => {
                console.log(`Fileserver started on port ${port}!`);
            })
            this.isStarted = true;
        }
    }
}
