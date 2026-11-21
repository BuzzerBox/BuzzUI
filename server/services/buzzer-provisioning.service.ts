import * as fs from 'fs';
import {execFile} from 'child_process';
import {ReadlineParser, SerialPort} from 'serialport';
import {BuzzerHelper, IUsbBuzzer, TUsbBuzzerError} from '../../shared/shared';
import {BoxSettingsService} from './box-settings.service';
import {ConfigService} from './config.service';
import {LoggerService} from './logger.service';
import {IUsbLink, UdpBuzzerService} from './udp-buzzer.service';

/**
 * Pulls EN low through RTS, as esptool does, with DTR off so that the ESP32 starts its firmware and not the bootloader.
 * Only for buzzers with a USB serial chip (udpBuzzer.provisioning.wakeUsbIds): a Feather ESP32-S3 has its own USB, where
 * RTS doesn't reset it, and with DTR off it stops sending.
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

/**
 * What the buzzer told in BUZZ READY
 */
interface IReady {
    macAddress: string;
    firmwareVersion?: string;
    // the WiFi the buzzer has, as it told in BUZZ READY (firmware 1.1.0 and later), and the color of its case (1.2.0)
    wifi?: {ssid?: string, host?: string, port?: number, color?: string};
}

interface ISessionResult extends Partial<IReady> {
    error?: TUsbBuzzerError;
}

/**
 * The open serial port of a buzzer that is plugged in. It stays open until the buzzer is unplugged, so that the game
 * can go over it (USB mode), and so that a buzzer that wakes up later is heard.
 */
interface ISession {
    path: string;
    port: SerialPort;
    open: boolean;
    // once the buzzer answered, again after it restarted
    ready?: IReady;
    // called with true on BUZZ READY, with false when the port closes
    readyWaiters: ((ready: boolean) => void)[];
    // waits for BUZZ OK (true) or BUZZ ERROR (false) after BUZZ WIFI; null when the port closes
    answerWaiter?: (ok: boolean | null) => void;
    // Date.now() of the last packet over USB, and of the last BUZZ LINK
    lastPacketMs: number;
    lastLinkMs: number;
    link: IUsbLink;
}

export type UsbBuzzersChangedCallback = (buzzers: IUsbBuzzer[]) => void;

/**
 * Wireless buzzers (firmware/wireless-buzzer) plugged into the box over USB: the box finds out who they are, and gives
 * one the box's WiFi when the master adopts it. The buzzer shows up as a serial port (udpBuzzer.provisioning.usbIds):
 * the USB serial chip of a Feather V2, or the Feather ESP32-S3 itself. Text lines at 115200 baud, among the buzzer's
 * log:
 *
 *   box → buzzer: BUZZ HELLO
 *   buzzer → box: BUZZ READY <mac> <firmware version> {"ssid":…,"host":…,"port":…,"color":…}    (also when it
 *                 starts; the WiFi it has, without the passphrase, or {} without one; older firmware leaves it out;
 *                 the color of its case since firmware 1.2.0, if it has one)
 *   box → buzzer: BUZZ WIFI {"ssid":…,"pass":…,"host":…,"port":…,"color":…}    (color: "#rrggbb", or "" for none)
 *   buzzer → box: BUZZ OK | BUZZ ERROR <reason>
 *
 * USB mode (firmware 1.4.0 and later, udpBuzzer.provisioning.usbMode): while the box sends BUZZ LINK and answers it,
 * the buzzer sends its heartbeats and presses over USB instead of the WiFi, as the same JSON packets as over UDP
 * (UdpBuzzerService), and gets the server's STATE packets there:
 *
 *   box → buzzer: BUZZ LINK                (after BUZZ READY, and again while no packet came for LINK_INTERVAL_IN_MS)
 *   buzzer → box: BUZZ PKT {"t":"HB",…} | BUZZ PKT {"t":"PRESS",…}
 *   box → buzzer: BUZZ PKT {"t":"STATE",…}
 *
 * Without an answer over USB for 3 s, or unplugged, the buzzer plays over the WiFi again.
 *
 * The master sees the buzzers and their state (IUsbBuzzer) and adopts them (IAdoptUsbBuzzerPacket).
 */
export class BuzzerProvisioningService {
    private static instance: BuzzerProvisioningService;
    private static readonly POLL_INTERVAL_IN_MS = 2000;
    private static readonly HELLO_INTERVAL_IN_MS = 500;
    // a buzzer in deep sleep doesn't answer; then it is reset, which wakes it (see wakeByReset)
    private static readonly RESET_AFTER_IN_MS = 2000;
    private static readonly TIMEOUT_IN_MS = 15000;
    // a port that can't be opened yet (e.g. right after it showed up) is tried again with the next look, this often
    private static readonly MAX_OPEN_ATTEMPTS = 5;
    // BUZZ LINK again while no packet came over USB for this long: the buzzer may have missed it, or slept
    private static readonly LINK_INTERVAL_IN_MS = 2000;

    // the buzzers that are plugged in, by their port
    private readonly buzzers = new Map<string, IUsbBuzzer>();
    // their open ports, by their port
    private readonly sessions = new Map<string, ISession>();
    // the ports whose buzzer sleeps while it is plugged in and is woken by a reset (udpBuzzer.provisioning.wakeUsbIds)
    private readonly wakeByReset = new Set<string>();
    private readonly onChangedCallbacks: UsbBuzzersChangedCallback[] = [];
    // how often each port couldn't be opened while identifying, until it is unplugged
    private readonly failedOpens = new Map<string, number>();
    // ports to identify again with the next look
    private readonly retryIdentify = new Set<string>();
    // ports that are being opened
    private readonly opening = new Set<string>();

    private constructor() {
        const conf = ConfigService.get().udpBuzzer;
        if (!conf?.enabled || !conf.provisioning?.enabled) {
            return;
        }
        setInterval(() => this.lookForBuzzers().catch(e => LoggerService.error('Could not look for USB buzzers', e)),
            BuzzerProvisioningService.POLL_INTERVAL_IN_MS);
        setInterval(() => this.keepLinks(), 1000);
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
     * Also tells which ones talk to this server over WiFi right now, and which ones play over USB
     */
    public getBuzzers(): IUsbBuzzer[] {
        return [...this.buzzers.values()].map(buzzer => ({
            ...buzzer,
            isConnected: buzzer.macAddress != null && UdpBuzzerService.get().isOnlineOverWifi(buzzer.macAddress),
            isUsbLinked: buzzer.macAddress != null && UdpBuzzerService.get().isPlayingOverUsb(buzzer.macAddress)
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
        this.giveWifi(path, wifi, caseColor).then(result => {
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
        const provisioning = ConfigService.get().udpBuzzer.provisioning;
        const usbIds: string[] = provisioning.usbIds.map(id => id.toLowerCase());
        const wakeUsbIds: string[] = (provisioning.wakeUsbIds ?? []).map(id => id.toLowerCase());
        const usbId = (port: {vendorId?: string, productId?: string}) => `${port.vendorId}:${port.productId}`.toLowerCase();
        const ports = (await SerialPort.list()).filter(port => usbIds.includes(usbId(port)));
        const paths = new Set(ports.map(port => port.path));
        this.wakeByReset.clear();
        ports.filter(port => wakeUsbIds.includes(usbId(port))).forEach(port => this.wakeByReset.add(port.path));
        let changed = false;
        for (const path of [...this.buzzers.keys()]) {
            if (!paths.has(path)) {
                LoggerService.log(`The buzzer at ${path} was unplugged`);
                this.buzzers.delete(path);
                this.failedOpens.delete(path);
                this.retryIdentify.delete(path);
                this.closeSession(path);
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
        this.openSession(path).then(async session => {
            if (session == null) {
                if (!this.buzzers.has(path)) {
                    return;
                }
                const attempts = (this.failedOpens.get(path) ?? 0) + 1;
                this.failedOpens.set(path, attempts);
                if (attempts < BuzzerProvisioningService.MAX_OPEN_ATTEMPTS) {
                    // still identifying for the master
                    this.retryIdentify.add(path);
                } else {
                    this.update(path, {state: 'no-answer'});
                }
                return;
            }
            // onReady() tells the master what it answered
            if (!await this.greet(session) && session.open) {
                this.update(path, {state: 'no-answer'});
            }
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
     * The session of the port, opened if it isn't yet; null if it can't be opened
     */
    private async openSession(path: string): Promise<ISession | null> {
        const existing = this.sessions.get(path);
        if (existing?.open) {
            return existing;
        }
        if (this.opening.has(path)) {
            return null;
        }
        // Not locked, so that reset() can open the port as well; opening raises DTR and RTS together, which doesn't
        // reset the ESP32. A Feather V2 keeps the lines when the port closes, as they lead to its reset. A Feather S3
        // (its own USB) drops DTR then, also when the server stops: it then knows that no one reads, while its writes
        // would otherwise fill its buffer.
        const hupcl = !this.wakeByReset.has(path);
        const port = new SerialPort({path, baudRate: 115200, autoOpen: false, hupcl, lock: false});
        this.opening.add(path);
        try {
            await new Promise<void>((resolve, reject) => port.open(err => err ? reject(err) : resolve()));
        } catch (e) {
            LoggerService.warn(`Could not open the buzzer's port ${path}`, e);
            return null;
        } finally {
            this.opening.delete(path);
        }
        if (!this.buzzers.has(path)) {
            // unplugged meanwhile
            port.close();
            return null;
        }
        const session: ISession = {
            path, port, open: true, readyWaiters: [], lastPacketMs: 0, lastLinkMs: 0,
            link: {path, send: json => this.send(session, 'BUZZ PKT ' + json)}
        };
        this.sessions.set(path, session);
        port.on('error', err => LoggerService.warn(`Serial error of the buzzer at ${path}`, err));
        port.on('close', () => this.onSessionClosed(session));
        port.pipe(new ReadlineParser({delimiter: '\n'})).on('data', (raw: string) => {
            // a failing line must not take the server down
            try {
                this.onLine(session, raw.trim());
            } catch (e) {
                LoggerService.error(`Could not handle the line of the buzzer at ${path}: ${raw}`, e);
            }
        });
        return session;
    }

    private onLine(session: ISession, line: string): void {
        if (line.startsWith('BUZZ PKT ')) {
            session.lastPacketMs = Date.now();
            UdpBuzzerService.get().onUsbPacket(line.slice('BUZZ PKT '.length), session.link);
        } else if (line.startsWith('BUZZ READY ')) {
            // also after the buzzer restarted, or woke up
            const [, , macAddress, firmwareVersion, ...wifiInfo] = line.split(' ');
            const ready: IReady = {macAddress, firmwareVersion};
            try {
                // an SSID may have spaces
                ready.wifi = wifiInfo.length > 0 ? JSON.parse(wifiInfo.join(' ')) : undefined;
            } catch (e) {
                LoggerService.warn(`Ignoring the WiFi the buzzer at ${session.path} told: ${wifiInfo.join(' ')}`);
            }
            this.onReady(session, ready);
        } else if (line === 'BUZZ OK') {
            session.answerWaiter?.(true);
        } else if (line.startsWith('BUZZ ERROR')) {
            session.answerWaiter?.(false);
        }
    }

    private onReady(session: ISession, ready: IReady): void {
        session.ready = ready;
        const waiters = session.readyWaiters.splice(0);
        waiters.forEach(waiter => waiter(true));
        const buzzer = this.buzzers.get(session.path);
        if (buzzer != null) {
            const result: ISessionResult = ready;
            if (buzzer.state === 'identifying' || buzzer.state === 'no-answer' || buzzer.state === 'detected') {
                const wifi = this.readWifiSettings(true);
                const isAdopted = wifi != null && ready.wifi?.ssid === wifi.ssid && ready.wifi?.host === wifi.serverAddress
                    && ready.wifi?.port === ConfigService.get().udpBuzzer.listenPort;
                this.update(session.path, {...this.describe(result), state: 'detected', ssid: ready.wifi?.ssid, isAdopted});
            } else if (buzzer.state !== 'adopting') {
                this.update(session.path, this.describe(result));
            }
        }
        this.link(session);
    }

    /**
     * Asks a buzzer that can play over USB to do so
     */
    private link(session: ISession): void {
        if (ConfigService.get().udpBuzzer.provisioning.usbMode === false
                || !BuzzerHelper.supportsUsbMode(session.ready?.firmwareVersion)) {
            return;
        }
        session.lastLinkMs = Date.now();
        this.send(session, 'BUZZ LINK');
    }

    /**
     * BUZZ LINK again to a buzzer that sent no packet over USB for a while
     */
    private keepLinks(): void {
        const now = Date.now();
        for (const session of this.sessions.values()) {
            if (session.open && session.ready != null
                    && now - session.lastPacketMs > BuzzerProvisioningService.LINK_INTERVAL_IN_MS
                    && now - session.lastLinkMs > BuzzerProvisioningService.LINK_INTERVAL_IN_MS) {
                this.link(session);
            }
        }
    }

    private send(session: ISession, line: string): void {
        if (!session.open) {
            return;
        }
        session.port.write(line + '\n', err => {
            if (err) {
                LoggerService.warn(`Could not write to the buzzer at ${session.path}: ${err}`);
            }
        });
    }

    private onSessionClosed(session: ISession): void {
        if (!session.open) {
            return;
        }
        session.open = false;
        if (this.sessions.get(session.path) === session) {
            this.sessions.delete(session.path);
        }
        session.readyWaiters.splice(0).forEach(waiter => waiter(false));
        session.answerWaiter?.(null);
        UdpBuzzerService.get().onUsbLinkClosed(session.path);
        if (this.buzzers.has(session.path)) {
            // closed while it is still listed: opened again with the next look, unless it was unplugged
            LoggerService.warn(`The port of the buzzer at ${session.path} closed`);
            this.retryIdentify.add(session.path);
        }
    }

    private closeSession(path: string): void {
        const session = this.sessions.get(path);
        if (session == null) {
            return;
        }
        this.onSessionClosed(session);
        if (session.port.isOpen) {
            session.port.close(err => err && LoggerService.warn(`Could not close the port ${path}: ${err}`));
        }
    }

    /**
     * Greets the buzzer until it answers with BUZZ READY, and wakes it by a reset if it sleeps. False if it doesn't
     * answer in time, or the port closes.
     */
    private greet(session: ISession): Promise<boolean> {
        if (!session.open) {
            return Promise.resolve(false);
        }
        const started = Date.now();
        let wasReset = false;
        return new Promise<boolean>(resolve => {
            const finish = (ready: boolean) => {
                clearInterval(hello);
                resolve(ready);
            };
            session.readyWaiters.push(finish);
            const hello = setInterval(() => {
                if (!wasReset && this.wakeByReset.has(session.path)
                        && Date.now() - started > BuzzerProvisioningService.RESET_AFTER_IN_MS) {
                    wasReset = true;
                    this.reset(session.path);
                }
                if (Date.now() - started > BuzzerProvisioningService.TIMEOUT_IN_MS) {
                    session.readyWaiters = session.readyWaiters.filter(waiter => waiter !== finish);
                    finish(false);
                } else {
                    this.send(session, 'BUZZ HELLO');
                }
            }, BuzzerProvisioningService.HELLO_INTERVAL_IN_MS);
        });
    }

    /**
     * Gives the buzzer the WiFi, with the color of its case unless that is undefined. Never rejects.
     */
    private async giveWifi(path: string, wifi: IWifiSettings, color?: string): Promise<ISessionResult> {
        const session = await this.openSession(path);
        if (session == null) {
            return {error: 'port-error'};
        }
        // also a buzzer that answered before: it may sleep by now, which greeting it wakes
        if (!await this.greet(session)) {
            return {error: session.open ? 'no-answer' : 'port-error'};
        }
        const ready = session.ready;
        const answer = await new Promise<boolean | null | undefined>(resolve => {
            const timeout = setTimeout(() => finish(undefined), BuzzerProvisioningService.TIMEOUT_IN_MS);
            const finish = (ok: boolean | null | undefined) => {
                clearTimeout(timeout);
                session.answerWaiter = undefined;
                resolve(ok);
            };
            session.answerWaiter = finish;
            this.send(session, 'BUZZ WIFI ' + JSON.stringify({
                ssid: wifi.ssid,
                pass: wifi.passphrase,
                host: wifi.serverAddress,
                port: ConfigService.get().udpBuzzer.listenPort,
                ...(color != null && BuzzerHelper.supportsCaseColor(ready.firmwareVersion) ? {color} : {})
            }));
        });
        if (answer === true) {
            return {...ready};
        }
        return {...ready, error: answer === false ? 'rejected' : answer === null ? 'port-error' : 'no-answer'};
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
        const settings = BoxSettingsService.parse(content);
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
