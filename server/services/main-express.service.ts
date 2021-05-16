import express, {Express} from "express";

export class MainExpressService {
    private static instance: MainExpressService;
    private main: Express;

    private constructor() {
        this.main = express();
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
