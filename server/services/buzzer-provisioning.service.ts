import * as fs from 'fs';
import {ReadlineParser, SerialPort} from 'serialport';
import {ConfigService} from './config.service';
import {LoggerService} from './logger.service';

interface IWifiSettings {
    ssid: string;
    passphrase: string;
    serverAddress: string;
}

/**
 * Gives a wireless buzzer (BuzzController/wireless) the box's WiFi when it is plugged into the box over USB. The
 * buzzer's USB serial chip shows up as a serial port (udpBuzzer.provisioning.usbIds); the box greets it and sends the
 * WiFi only to a buzzer that answers. Text lines at 115200 baud:
 *
 *   box → buzzer: BUZZ HELLO
 *   buzzer → box: BUZZ READY <mac> <firmware version>    (also when it starts)
 *   box → buzzer: BUZZ WIFI {"ssid":…,"pass":…,"host":…,"port":…}
 *   buzzer → box: BUZZ OK | BUZZ ERROR <reason>
 *
 * Each buzzer is set up once per plugging in.
 */
export class BuzzerProvisioningService {
    private static instance: BuzzerProvisioningService;
    private static readonly POLL_INTERVAL_IN_MS = 2000;
    private static readonly HELLO_INTERVAL_IN_MS = 500;
    // a buzzer in deep sleep doesn't answer; then it is reset, which wakes it
    private static readonly RESET_AFTER_IN_MS = 2000;
    private static readonly TIMEOUT_IN_MS = 15000;
    // a port that can't be opened yet (e.g. right after it showed up) is tried again with the next look, this often
    private static readonly MAX_OPEN_ATTEMPTS = 5;

    // the ports of buzzers that are plugged in, so each is set up once
    private readonly knownPaths = new Set<string>();
    // how often each port couldn't be opened, until it is unplugged
    private readonly failedOpens = new Map<string, number>();

    private constructor() {
        const conf = ConfigService.get().udpBuzzer;
        if (!conf?.enabled || !conf.provisioning?.enabled) {
            return;
        }
        setInterval(() => this.lookForBuzzers().catch(e => LoggerService.error('Could not look for USB buzzers', e)),
            BuzzerProvisioningService.POLL_INTERVAL_IN_MS);
    }

    public static start(): void {
        if (this.instance == null) {
            this.instance = new BuzzerProvisioningService();
        }
    }

    private async lookForBuzzers(): Promise<void> {
        const usbIds: string[] = ConfigService.get().udpBuzzer.provisioning.usbIds.map(id => id.toLowerCase());
        const ports = (await SerialPort.list())
            .filter(port => usbIds.includes(`${port.vendorId}:${port.productId}`.toLowerCase()));
        const paths = new Set(ports.map(port => port.path));
        // unplugged: set it up again the next time
        for (const path of [...this.knownPaths]) {
            if (!paths.has(path)) {
                this.knownPaths.delete(path);
                this.failedOpens.delete(path);
            }
        }
        for (const path of paths) {
            if (!this.knownPaths.has(path)) {
                this.knownPaths.add(path);
                this.provision(path).catch(e => LoggerService.error(`Could not set up the buzzer at ${path}`, e));
            }
        }
    }

    private async provision(path: string): Promise<void> {
        const wifi = this.readWifiSettings();
        if (wifi == null) {
            return;
        }
        LoggerService.log(`Setting up the buzzer at ${path}`);
        const port = new SerialPort({path, baudRate: 115200, autoOpen: false, hupcl: false});
        try {
            await new Promise<void>((resolve, reject) => port.open(err => err ? reject(err) : resolve()));
        } catch (e) {
            const attempts = (this.failedOpens.get(path) ?? 0) + 1;
            this.failedOpens.set(path, attempts);
            if (attempts < BuzzerProvisioningService.MAX_OPEN_ATTEMPTS) {
                LoggerService.warn(`Could not open the buzzer at ${path}, trying again`, e);
                this.knownPaths.delete(path);
                return;
            }
            throw e;
        }
        port.on('error', err => LoggerService.warn(`Serial error of the buzzer at ${path}`, err));
        // DTR and RTS reset the ESP32 (as for flashing); both off leaves it running
        this.setLines(port, false);
        const lines = port.pipe(new ReadlineParser({delimiter: '\n'}));
        const send = (line: string) => port.write(line + '\n');
        const started = Date.now();
        let wasReset = false;
        let mac: string = null;
        try {
            const result = await new Promise<string>(resolve => {
                const hello = setInterval(() => {
                    if (mac == null && !wasReset && Date.now() - started > BuzzerProvisioningService.RESET_AFTER_IN_MS) {
                        wasReset = true;
                        this.reset(port);
                    }
                    if (Date.now() - started > BuzzerProvisioningService.TIMEOUT_IN_MS) {
                        clearInterval(hello);
                        resolve('no answer');
                    } else if (mac == null) {
                        send('BUZZ HELLO');
                    }
                }, BuzzerProvisioningService.HELLO_INTERVAL_IN_MS);
                lines.on('data', (raw: string) => {
                    const line = raw.trim();
                    if (line.startsWith('BUZZ READY ')) {
                        // again after the buzzer restarted
                        mac = line.split(' ')[2] ?? '?';
                        send('BUZZ WIFI ' + JSON.stringify({
                            ssid: wifi.ssid,
                            pass: wifi.passphrase,
                            host: wifi.serverAddress,
                            port: ConfigService.get().udpBuzzer.listenPort
                        }));
                    } else if (line === 'BUZZ OK' || line.startsWith('BUZZ ERROR')) {
                        clearInterval(hello);
                        resolve(line);
                    }
                });
            });
            if (result === 'BUZZ OK') {
                LoggerService.log(`Buzzer ${mac} at ${path} now knows the WiFi ${wifi.ssid}`);
            } else {
                LoggerService.warn(`Could not set up the buzzer at ${path}: ${result}`);
            }
        } finally {
            port.close();
        }
    }

    /**
     * Pulls EN low through RTS, as esptool does, with DTR off so that the ESP32 starts its firmware and not the
     * bootloader
     */
    private reset(port: SerialPort): void {
        this.setLines(port, true, () => setTimeout(() => this.setLines(port, false), 100));
    }

    private setLines(port: SerialPort, rts: boolean, then?: () => void): void {
        port.set({dtr: false, rts}, err => {
            if (err) {
                LoggerService.warn(`Could not set DTR/RTS of ${port.path}`, err);
            }
            then?.();
        });
    }

    /**
     * The settings file has KEY=value lines; on the box buzzerbox-apply-settings writes it from buzzerbox.txt
     */
    private readWifiSettings(): IWifiSettings {
        const file = ConfigService.get().udpBuzzer.provisioning.settingsFile;
        let content: string;
        try {
            content = fs.readFileSync(file, 'utf8');
        } catch (e) {
            LoggerService.warn(`Can't set up buzzers without the WiFi settings in ${file}`, e);
            return null;
        }
        const settings = new Map<string, string>();
        for (const line of content.split(/\r?\n/)) {
            const index = line.indexOf('=');
            if (index > 0 && !line.trim().startsWith('#')) {
                settings.set(line.slice(0, index).trim(), line.slice(index + 1).trim());
            }
        }
        const wifi: IWifiSettings = {
            ssid: settings.get('WIFI_SSID'),
            passphrase: settings.get('WIFI_PASSPHRASE'),
            serverAddress: settings.get('SERVER_IP_ADDRESS')
        };
        if (!wifi.ssid || !wifi.passphrase || !wifi.serverAddress) {
            LoggerService.warn(`${file} lacks WIFI_SSID, WIFI_PASSPHRASE or SERVER_IP_ADDRESS`);
            return null;
        }
        return wifi;
    }
}
