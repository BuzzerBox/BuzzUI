import express, {Express} from "express";
import cors from "cors";

export class MainExpressService {
    private static instance: MainExpressService;
    private main: Express;

    private constructor() {
        this.main = express();
        // the client is served from another port, or another host in dev
        this.main.use(cors());
    }

    public static get(): MainExpressService {
        if (this.instance == null) {
            this.instance = new MainExpressService();
        }
        return this.instance;
    }

    public getMain(): Express {
        return this.main;
    }
}
