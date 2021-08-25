// TODO find out what type DATA is
import SerialPort from 'serialport';
import {ConfigService} from './config.service';
import {LoggerService} from './logger.service';


export type SerialPortDataInCallback = (data) => void;

export class SerialPortService {
    private static instance: SerialPortService;
    private onDataInCallbacks: SerialPortDataInCallback[];
    private serialPortConnection;

    private constructor() {
        this.onDataInCallbacks = [];
        this.serialPortConnection = new SerialPort(ConfigService.get().serial.address);
        this.serialPortConnection.on('error', LoggerService.error);
        this.serialPortConnection.on('data', this.onDataIn.bind(this))
    }

    public static get(): SerialPortService {
        if (this.instance == null) {
            this.instance = new SerialPortService();
        }
        return this.instance;
    }

    public addOnDataInCallback(callback: SerialPortDataInCallback): void {
        this.onDataInCallbacks.push(callback);
    }

    private onDataIn(data): void {
        for (const callback of this.onDataInCallbacks) {
            callback(data);
        }
    }

    public write(bytes: Buffer[]): void {
        this.serialPortConnection.write(Buffer.concat(bytes));
    }

}
