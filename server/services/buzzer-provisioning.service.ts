import * as fs from 'fs';
import {execFile} from 'child_process';
import {ReadlineParser, SerialPort} from 'serialport';
import {BuzzerHelper, IUsbBuzzer, TUsbBuzzerError} from '../../shared/shared';
import {ConfigService} from './config.service';
import {LoggerService} from './logger.service';
import {UdpBuzzerService} from './udp-buzzer.service';

/**
 * Pulls EN low through RTS, as esptool does, with DTR off so that the ESP32 starts its firmware and not the bootloader.
 * serialport's set() can't do it on Linux: it clears a break (TIOCCBRK) before it sets the lines, and the kernel's
 * cdc_acm driver refuses that for the Feather's USB serial chip (EOPNOTSUPP), so the lines are never set. This sets
 * only the lines, on a second file descriptor of the port; python3 is on the box (Raspberry Pi OS, and Ansible needs it).
 */
const RESET_SCRIPT = `
import fcntl, os, struct, sys, termios, time
fd = os.open(sys.argv[1], os.O_RDWR | os.O_NOCTTY | os.O_NONBLOCK)
try:
    dtr = struct.pack('I', termios.TIOCM_DTR)
    rts = struct.pack('I', termios.TIOCM_RTS)
    fcntl.ioctl(fd, termios.TIOCMBIC, dtr)
    fcntl.ioctl(fd, termios.TIOCMBIS, rts)
    time.sleep(0.1)
    fcntl.ioctl(fd, termios.TIOCMBIC, rts)
finally:
    os.close(fd)
`;

interface IWifiSettings {
    ssid: string;
    passphrase: string;
    serverAddress: string;
}

interface ISessionResult {
    // the port couldn't be opened at all (e.g. right after it showed up)
    openFailed?: boolean;
    macAddress?: string;
    firmwareVersion?: string;
    // the WiFi the buzzer has, as it told in BUZZ READY (firmware 1.1.0 and later), and the color of its case (1.2.0)
    wifi?: {ssid?: string, host?: string, port?: number, color?: string};
    error?: TUsbBuzzerError;
}

export type UsbBuzzersChangedCallback = (buzzers: IUsbBuzzer[]) => void;

/**
 * Wireless buzzers (BuzzController/wireless) plugged into the box over USB: the box finds out who they are, and gives
 * one the box's WiFi when the master adopts it. The buzzer's USB serial chip shows up as a serial port
 * (udpBuzzer.provisioning.usbIds). Text lines at 115200 baud:
 *
 *   box → buzzer: BUZZ HELLO
 *   buzzer → box: BUZZ READY <mac> <firmware version> {"ssid":…,"host":…,"port":…,"color":…}    (also when it
 *                 starts; the WiFi it has, without the passphrase, or {} without one; older firmware leaves it out;
 *                 the color of its case since firmware 1.2.0, if it has one)
 *   box → buzzer: BUZZ WIFI {"ssid":…,"pass":…,"host":…,"port":…,"color":…}    (color: "#rrggbb", or "" for none)
 *   buzzer → box: BUZZ OK | BUZZ ERROR <reason>
 *
 * The master sees the buzzers and their state (IUsbBuzzer) and adopts them (IAdoptUsbBuzzerPacket).
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

    // the buzzers that are plugged in, by their port
    private readonly buzzers = new Map<string, IUsbBuzzer>();
    private readonly onChangedCallbacks: UsbBuzzersChangedCallback[] = [];
    // how often each port couldn't be opened while identifying, until it is unplugged
    private readonly failedOpens = new Map<string, number>();
    // ports to identify again with the next look
    private readonly retryIdentify = new Set<string>();

    private constructor() {
        const conf = ConfigService.get().udpBuzzer;
        if (!conf?.enabled || !conf.provisioning?.enabled) {
            return;
        }
        setInterval(() => this.lookForBuzzers().catch(e => LoggerService.error('Could not look for USB buzzers', e)),
            BuzzerProvisioningService.POLL_INTERVAL_IN_MS);
    }

    public static get(): BuzzerProvisioningService {
        if (this.instance == null) {
            this.instance = new BuzzerProvisioningService();
        }
        return this.instance;
    }

    public addOnChangedCallback(callback: UsbBuzzersChangedCallback): void {
        this.onChangedCallbacks.push(callback);
    }

    /**
     * Also tells which ones talk to this server over WiFi right now
     */
    public getBuzzers(): IUsbBuzzer[] {
        return [...this.buzzers.values()].map(buzzer => ({
            ...buzzer,
            isConnected: buzzer.macAddress != null && UdpBuzzerService.get().isOnline(buzzer.macAddress)
        }));
    }

    /**
     * Gives the buzzer at that port the box's WiFi; also one that didn't answer or failed before
     * @param color the color of its case ("#rrggbb", "" for none), which the buzzer keeps; undefined keeps the one it has
     */
    public adopt(path: string, color?: string): void {
        const buzzer = this.buzzers.get(path);
        if (buzzer == null || buzzer.state === 'identifying' || buzzer.state === 'adopting') {
            return;
        }
        const wifi = this.readWifiSettings();
        if (wifi == null) {
            this.update(path, {state: 'failed', error: 'no-wifi-settings'});
            return;
        }
        // anything else isn't sent, so that the buzzer doesn't refuse the WiFi for it
        const caseColor = color === '' ? '' : BuzzerHelper.normalizeColor(color);
        this.update(path, {state: 'adopting', error: undefined});
        LoggerService.log(`Adopting the buzzer at ${path}` + (caseColor != null ? ` with the color ${caseColor || 'none'}` : ''));
        this.talk(path, wifi, caseColor).then(result => {
            if (result.error == null) {
                LoggerService.log(`Buzzer ${result.macAddress} at ${path} now knows the WiFi ${wifi.ssid}`);
                // older firmware doesn't keep a color
                const keepsColor = caseColor != null && BuzzerHelper.supportsCaseColor(result.firmwareVersion);
                const described = this.describe(result);
                this.update(path, {
                    ...described,
                    color: keepsColor ? caseColor || undefined : described.color,
                    state: 'adopted',
                    ssid: wifi.ssid,
                    isAdopted: true
                });
            } else {
                LoggerService.warn(`Could not adopt the buzzer at ${path}: ${result.error}`);
                this.update(path, {...this.describe(result), state: 'failed', error: result.error});
            }
        });
    }

    private async lookForBuzzers(): Promise<void> {
        const usbIds: string[] = ConfigService.get().udpBuzzer.provisioning.usbIds.map(id => id.toLowerCase());
        const ports = (await SerialPort.list())
            .filter(port => usbIds.includes(`${port.vendorId}:${port.productId}`.toLowerCase()));
        const paths = new Set(ports.map(port => port.path));
        let changed = false;
        for (const path of [...this.buzzers.keys()]) {
            if (!paths.has(path)) {
                LoggerService.log(`The buzzer at ${path} was unplugged`);
                this.buzzers.delete(path);
                this.failedOpens.delete(path);
                this.retryIdentify.delete(path);
                changed = true;
            }
        }
        if (changed) {
            this.notifyChanged();
        }
        for (const path of paths) {
            if (!this.buzzers.has(path) || this.retryIdentify.delete(path)) {
                this.identify(path);
            }
        }
    }

    private identify(path: string): void {
        if (!this.buzzers.has(path)) {
            LoggerService.log(`A buzzer was plugged in at ${path}`);
            this.buzzers.set(path, {path, state: 'identifying'});
            this.notifyChanged();
        }
        this.talk(path, null).then(result => {
            if (result.openFailed && this.buzzers.has(path)) {
                const attempts = (this.failedOpens.get(path) ?? 0) + 1;
                this.failedOpens.set(path, attempts);
                if (attempts < BuzzerProvisioningService.MAX_OPEN_ATTEMPTS) {
                    // still identifying for the master
                    this.retryIdentify.add(path);
                    return;
                }
            }
            if (result.error != null) {
                this.update(path, {state: 'no-answer'});
                return;
            }
            const wifi = this.readWifiSettings(true);
            const isAdopted = wifi != null && result.wifi?.ssid === wifi.ssid && result.wifi?.host === wifi.serverAddress
                && result.wifi?.port === ConfigService.get().udpBuzzer.listenPort;
            this.update(path, {...this.describe(result), state: 'detected', ssid: result.wifi?.ssid, isAdopted});
        });
    }

    /**
     * What the master gets of a session's result
     */
    private describe(result: ISessionResult): Partial<IUsbBuzzer> {
        return {
            macAddress: result.macAddress,
            firmwareVersion: result.firmwareVersion,
            color: BuzzerHelper.normalizeColor(result.wifi?.color)
        };
    }

    /**
     * Changes a buzzer that is still plugged in
     */
    private update(path: string, changes: Partial<IUsbBuzzer>): void {
        const buzzer = this.buzzers.get(path);
        if (buzzer == null) {
            return;
        }
        this.buzzers.set(path, {...buzzer, ...changes});
        this.notifyChanged();
    }

    private notifyChanged(): void {
        const buzzers = this.getBuzzers();
        this.onChangedCallbacks.forEach(callback => callback(buzzers));
    }

    /**
     * Greets the buzzer, and gives it the WiFi if there is one to give, with the color of its case unless that is
     * undefined. Never rejects.
     */
    private async talk(path: string, wifi: IWifiSettings | null, color?: string): Promise<ISessionResult> {
        // not locked, so that reset() can open the port as well; opening raises DTR and RTS together, which doesn't
        // reset the ESP32
        const port = new SerialPort({path, baudRate: 115200, autoOpen: false, hupcl: false, lock: false});
        try {
            await new Promise<void>((resolve, reject) => port.open(err => err ? reject(err) : resolve()));
        } catch (e) {
            LoggerService.warn(`Could not open the buzzer's port ${path}`, e);
            return {error: 'port-error', openFailed: true};
        }
        port.on('error', err => LoggerService.warn(`Serial error of the buzzer at ${path}`, err));
        const lines = port.pipe(new ReadlineParser({delimiter: '\n'}));
        const send = (line: string) => port.write(line + '\n');
        const started = Date.now();
        let wasReset = false;
        const result: ISessionResult = {};
        try {
            return await new Promise<ISessionResult>(resolve => {
                const finish = (error?: TUsbBuzzerError) => {
                    clearInterval(hello);
                    resolve({...result, error});
                };
                const hello = setInterval(() => {
                    if (result.macAddress == null && !wasReset
                            && Date.now() - started > BuzzerProvisioningService.RESET_AFTER_IN_MS) {
                        wasReset = true;
                        this.reset(path);
                    }
                    if (Date.now() - started > BuzzerProvisioningService.TIMEOUT_IN_MS) {
                        finish('no-answer');
                    } else if (result.macAddress == null) {
                        send('BUZZ HELLO');
                    }
                }, BuzzerProvisioningService.HELLO_INTERVAL_IN_MS);
                port.on('close', () => finish('port-error'));
                lines.on('data', (raw: string) => {
                    const line = raw.trim();
                    if (line.startsWith('BUZZ READY ')) {
                        // again after the buzzer restarted
                        const [, , macAddress, firmwareVersion, ...wifiInfo] = line.split(' ');
                        result.macAddress = macAddress;
                        result.firmwareVersion = firmwareVersion;
                        try {
                            // an SSID may have spaces
                            result.wifi = wifiInfo.length > 0 ? JSON.parse(wifiInfo.join(' ')) : undefined;
                        } catch (e) {
                            LoggerService.warn(`Ignoring the WiFi the buzzer at ${path} told: ${wifiInfo.join(' ')}`);
                        }
                        if (wifi == null) {
                            finish();
                            return;
                        }
                        send('BUZZ WIFI ' + JSON.stringify({
                            ssid: wifi.ssid,
                            pass: wifi.passphrase,
                            host: wifi.serverAddress,
                            port: ConfigService.get().udpBuzzer.listenPort,
                            ...(color != null && BuzzerHelper.supportsCaseColor(result.firmwareVersion) ? {color} : {})
                        }));
                    } else if (line === 'BUZZ OK') {
                        finish();
                    } else if (line.startsWith('BUZZ ERROR')) {
                        finish('rejected');
                    }
                });
            });
        } finally {
            if (port.isOpen) {
                port.close();
            }
        }
    }

    /**
     * Restarts the ESP32, which wakes a sleeping buzzer, see RESET_SCRIPT
     */
    private reset(path: string): void {
        execFile('python3', ['-I', '-c', RESET_SCRIPT, path], {timeout: 5000}, (err, stdout, stderr) => {
            if (err) {
                LoggerService.warn(`Could not reset the buzzer at ${path}: ${stderr || err.message}`);
            }
        });
    }

    /**
     * The settings file has KEY=value lines; on the box buzzerbox-apply-settings writes it from buzzerbox.txt
     */
    private readWifiSettings(quiet = false): IWifiSettings {
        const file = ConfigService.get().udpBuzzer.provisioning.settingsFile;
        let content: string;
        try {
            content = fs.readFileSync(file, 'utf8');
        } catch (e) {
            if (!quiet) {
                LoggerService.warn(`Can't adopt buzzers without the WiFi settings in ${file}`, e);
            }
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
