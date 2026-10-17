import { SerialPort } from 'serialport';
import {ConfigService} from './config.service';
import {LoggerService} from './logger.service';
import {Buffer} from 'buffer';
import {Byte} from '../../shared/objects/byte';
import {ByteHelper} from '../../shared/helper/byte.helper';


export type SerialPortDataInCallback = (data: Buffer) => void;
export type SerialPortErrorCallback = (error) => void;

export class SerialPortService {
    private static instance: SerialPortService;
    private onDataInCallbacks: SerialPortDataInCallback[];
    private onErrorCallbacks: SerialPortErrorCallback[];
    private serialPortConnection;

    private constructor() {
        this.onDataInCallbacks = [];
        this.onErrorCallbacks = [];
        if (!ConfigService.get().serial.enabled) {
            // e.g. in the test environment, where buzzers come from browser keypresses only
            LoggerService.warn('Serial port is disabled in the config');
            return;
        }
        this.serialPortConnection = new SerialPort({
            path: ConfigService.get().serial.address,
            baudRate: ConfigService.get().serial.baudRate
        });
        this.serialPortConnection.on('error', this.onError.bind(this));
        this.serialPortConnection.on('data', this.onDataIn.bind(this))
        // the microcontroller treats every eol byte as a heartbeat and shows a lost connection
        // (the dot on the 7-segment display) when none arrives for 6 s
        setInterval(() => this.sendHeartbeat(), ConfigService.get().serial.heartbeatIntervalInMS);
    }

    private sendHeartbeat(): void {
        // skip while the port is closed, so a missing port doesn't log an error every interval
        if (this.serialPortConnection.isOpen) {
            this.write(Buffer.from([ConfigService.get().serial.eol]));
        }
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

    public addOnErrorCallback(callback: SerialPortErrorCallback): void {
        this.onErrorCallbacks.push(callback);
    }

    private onDataIn(data: Buffer): void {
        for (const callback of this.onDataInCallbacks) {
            callback(data);
        }
    }

    private onError(error): void {
        LoggerService.error(error);
        for (const callback of this.onErrorCallbacks) {
            callback(error);
        }
    }

    /**
     * Only accepts Bytes
     * @param bytes
     */
    public writeBytes(bytes: Byte[]): void {
        this.write(ByteHelper.bytesToBuffer(bytes));
    }

    public write(buffer: Buffer): void {
        this.serialPortConnection?.write(buffer);
    }

}
