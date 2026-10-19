import * as dgram from 'dgram';
import {Buffer} from 'buffer';
import {BuzzerHelper, IBuzzer} from '../../shared/shared';
import {ConfigService} from './config.service';
import {LoggerService} from './logger.service';

/**
 * The "t" field of every packet between the server and the wireless buzzers (ESP32)
 */
enum EUdpPacketType {
    // buzzer → server, regularly: the buzzer is there
    HEARTBEAT = 'HB',
    // buzzer → server: the button was pressed
    PRESS = 'PRESS',
    // server → buzzer: whether it lights up and whether presses count
    STATE = 'STATE',
}

interface IHeartbeatPacket {
    t: EUdpPacketType.HEARTBEAT;
    // the buzzer's MAC address, e.g. "AA:BB:CC:DD:EE:FF"
    id: string;
    // the port the buzzer listens on for STATE packets; the port it sent from if missing
    lp?: number;
    // counts the heartbeats; the answer repeats it as "ack", so the buzzer can measure the round trip
    seq?: number;
    // battery voltage in mV
    bat?: number;
    // firmware version
    fw?: string;
    // why the buzzer started last (e.g. POWERON, BROWNOUT, PANIC), and how long ago in s
    rr?: string;
    up?: number;
    // how often its WiFi dropped since then, and the reason of the last drop (ESP-IDF wifi_err_reason_t)
    wd?: number;
    wr?: number;
    // the color of its case, "#rrggbb" (firmware 1.2.0 and later, once the box gave it one)
    col?: string;
}

interface IPressPacket {
    t: EUdpPacketType.PRESS;
    id: string;
    // when the button was pressed, on the server's clock (STATE.st) in µs, as far as the buzzer has synchronized it
    ts?: number;
    // counts the presses: the buzzer sends a press again until a STATE with "pa" acknowledges it
    n?: number;
}

interface IStatePacket {
    t: EUdpPacketType.STATE;
    // the buzzer's team buzzed and is marked
    selected: boolean;
    // presses don't count right now
    locked: boolean;
    // a game is running, so the buzzer stays awake
    game: boolean;
    // the server's clock in µs, see UdpBuzzerService.now()
    st: number;
    // in answer to a heartbeat: its seq
    ack?: number;
    // in answer to a press: its n
    pa?: number;
}

interface IUdpBuzzer {
    id: string;
    macAddress: string;
    name: string;
    ip: string;
    port: number;
    // Date.now() of the last packet from it
    lastSeen: number;
    online: boolean;
    // the n of the last press, so that a press sent again is taken once
    lastPressNumber?: number;
    batteryLow: boolean;
    // of its case, as the last heartbeat told
    color?: string;
    // of the last heartbeat, to notice restarts and WiFi drops
    lastUptimeS?: number;
    lastWifiDrops?: number;
}

export interface IUdpBuzzerState {
    selected: boolean;
    locked: boolean;
    game: boolean;
}

/**
 * Gets the IDs of the buzzers that were pressed within one collection window, the earliest press first
 */
export type UdpBuzzerPressCallback = (buzzerIds: string[]) => void;
export type UdpBuzzersChangedCallback = () => void;
export type UdpBuzzerStateProvider = (buzzerId: string) => IUdpBuzzerState;

/**
 * Talks to the wireless buzzers (ESP32) over UDP. They announce themselves with heartbeats, so they don't have to be
 * configured. A buzzer that stops sending heartbeats is shown as offline but stays known with the same ID, so its team
 * keeps it when it comes back.
 */
export class UdpBuzzerService {
    private static instance: UdpBuzzerService;
    private static readonly MAC_ADDRESS = /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/i;
    // the longest a press can take to arrive: the buzzer sends it again for 300 ms (BuzzController/wireless config.h)
    private static readonly MAX_PRESS_DELAY_IN_US = 500000;

    private socket: dgram.Socket;
    // by MAC address, in the order they were found, which is the order of their buzzerIndex
    private readonly buzzers = new Map<string, IUdpBuzzer>();
    private readonly onPressCallbacks: UdpBuzzerPressCallback[] = [];
    private readonly onBuzzersChangedCallbacks: UdpBuzzersChangedCallback[] = [];
    private stateProvider: UdpBuzzerStateProvider = () => ({selected: false, locked: false, game: false});
    // the time the server started, for now()
    private readonly startTime = process.hrtime();
    // the presses of the current collection window, the earliest one per buzzer
    private presses = new Map<string, number>();
    private pressWindowTimer: ReturnType<typeof setTimeout> = null;

    private constructor() {
        const conf = ConfigService.get().udpBuzzer;
        if (!conf?.enabled) {
            LoggerService.log('UDP buzzers are disabled in the config');
            return;
        }
        this.socket = dgram.createSocket('udp4');
        this.socket.on('message', this.onMessage.bind(this));
        this.socket.on('error', err => LoggerService.error('UDP buzzer socket error', err));
        this.socket.bind(conf.listenPort, () => LoggerService.log(`Listening for UDP buzzers on port ${conf.listenPort}`));
        setInterval(() => this.markTimedOutBuzzersOffline(), 1000);
    }

    public static get(): UdpBuzzerService {
        if (this.instance == null) {
            this.instance = new UdpBuzzerService();
        }
        return this.instance;
    }

    public addOnPressCallback(callback: UdpBuzzerPressCallback): void {
        this.onPressCallbacks.push(callback);
    }

    public addOnBuzzersChangedCallback(callback: UdpBuzzersChangedCallback): void {
        this.onBuzzersChangedCallbacks.push(callback);
    }

    /**
     * Tells what each buzzer shows; it is sent to the buzzers by sendStateToAll() and in answer to every heartbeat
     */
    public setStateProvider(provider: UdpBuzzerStateProvider): void {
        this.stateProvider = provider;
    }

    public isOnline(macAddress: string): boolean {
        return this.buzzers.get(macAddress.toUpperCase())?.online === true;
    }

    /**
     * All buzzers found since the server started, in the order they were found
     */
    public getBuzzers(): IBuzzer[] {
        return [...this.buzzers.values()].map(buzzer => ({
            id: buzzer.id,
            name: buzzer.name,
            keyBind: '',
            byteBind: '',
            type: 'udp',
            online: buzzer.online,
            batteryLow: buzzer.batteryLow,
            color: buzzer.color
        }));
    }

    /**
     * Sends every online buzzer what it shows now. UDP packets can get lost, so the answers to the heartbeats repeat it.
     */
    public sendStateToAll(): void {
        for (const buzzer of this.buzzers.values()) {
            if (buzzer.online) {
                // the game calls this while it locks and releases; a buzzer must not break that
                try {
                    this.sendState(buzzer);
                } catch (e) {
                    LoggerService.error(`Could not send the state to UDP buzzer ${buzzer.macAddress}`, e);
                }
            }
        }
    }

    private onMessage(msg: Buffer, rinfo: dgram.RemoteInfo): void {
        let packet: IHeartbeatPacket | IPressPacket;
        try {
            packet = JSON.parse(msg.toString());
        } catch (e) {
            LoggerService.warn(`Ignoring broken UDP packet from ${rinfo.address}: ${msg}`);
            return;
        }
        // anything on the WiFi can send here; only MAC addresses become buzzers, so the list can't fill up with junk
        if (typeof packet?.id !== 'string' || !UdpBuzzerService.MAC_ADDRESS.test(packet.id)) {
            LoggerService.warn(`Ignoring UDP packet without a valid buzzer ID from ${rinfo.address}: ${msg}`);
            return;
        }
        // a failing packet must not take the server down
        try {
            if (packet.t === EUdpPacketType.HEARTBEAT) {
                const buzzer = this.onSignOfLife(packet.id, rinfo, packet.lp);
                this.onBattery(buzzer, packet.bat);
                this.onColor(buzzer, packet.col);
                this.onDiagnostics(buzzer, packet);
                this.sendState(buzzer, {ack: packet.seq});
            } else if (packet.t === EUdpPacketType.PRESS) {
                // the press may come before the first heartbeat
                const buzzer = this.onSignOfLife(packet.id, rinfo);
                const isRepeated = typeof packet.n === 'number' && packet.n === buzzer.lastPressNumber;
                if (!isRepeated) {
                    buzzer.lastPressNumber = packet.n;
                    this.onPress(buzzer, packet.ts, this.now());
                }
                // so that the buzzer stops sending it; whether it won follows after the collection window
                this.sendState(buzzer, {pa: packet.n});
            } else {
                LoggerService.warn(`Ignoring UDP packet of unknown type from ${rinfo.address}: ${msg}`);
            }
        } catch (e) {
            LoggerService.error(`Could not handle UDP packet from ${rinfo.address}: ${msg}`, e);
        }
    }

    private onSignOfLife(macAddress: string, rinfo: dgram.RemoteInfo, listenPort?: number): IUdpBuzzer {
        const key = macAddress.toUpperCase();
        let buzzer = this.buzzers.get(key);
        let changed = false;
        if (buzzer == null) {
            buzzer = {
                id: BuzzerHelper.makeUdpBuzzerId(key),
                macAddress: key,
                name: BuzzerHelper.makeUdpBuzzerName(key),
                ip: rinfo.address,
                port: UdpBuzzerService.isValidPort(listenPort) ? listenPort : rinfo.port,
                lastSeen: Date.now(),
                online: true,
                batteryLow: false
            };
            this.buzzers.set(key, buzzer);
            LoggerService.log(`Found UDP buzzer ${key} at ${buzzer.ip}:${buzzer.port}`);
            changed = true;
        } else if (!buzzer.online) {
            LoggerService.log(`UDP buzzer ${key} is back at ${rinfo.address}`);
            buzzer.online = true;
            changed = true;
        }
        buzzer.lastSeen = Date.now();
        buzzer.ip = rinfo.address;
        if (UdpBuzzerService.isValidPort(listenPort)) {
            buzzer.port = listenPort;
        }
        if (changed) {
            this.notifyBuzzersChanged();
        }
        return buzzer;
    }

    /**
     * Logs what tells why a buzzer restarted or dropped off: a restart shows as an uptime that went back, also when it
     * was too quick to count as offline
     */
    private onDiagnostics(buzzer: IUdpBuzzer, packet: IHeartbeatPacket): void {
        if (typeof packet.up !== 'number') {
            return;
        }
        const details = `firmware ${packet.fw}, started by ${packet.rr} ${packet.up} s ago, battery ${packet.bat} mV`;
        if (buzzer.lastUptimeS == null) {
            LoggerService.log(`UDP buzzer ${buzzer.macAddress}: ${details}`);
        } else if (packet.up < buzzer.lastUptimeS) {
            LoggerService.warn(`UDP buzzer ${buzzer.macAddress} restarted: ${details}`);
        } else if ((packet.wd ?? 0) > (buzzer.lastWifiDrops ?? 0)) {
            LoggerService.warn(`UDP buzzer ${buzzer.macAddress}: WiFi dropped ${packet.wd} times, last with reason ${packet.wr}`);
        }
        buzzer.lastUptimeS = packet.up;
        buzzer.lastWifiDrops = packet.wd ?? 0;
    }

    /**
     * The low battery warning has a hysteresis, so that a voltage around the limit doesn't flip it with every heartbeat
     */
    private onBattery(buzzer: IUdpBuzzer, millivolts: number): void {
        if (typeof millivolts !== 'number' || millivolts <= 0) {
            return;
        }
        const lowInMV = ConfigService.get().udpBuzzer.batteryLowInMV;
        const batteryLow = buzzer.batteryLow ? millivolts < lowInMV + 100 : millivolts < lowInMV;
        if (batteryLow !== buzzer.batteryLow) {
            LoggerService.log(`UDP buzzer ${buzzer.macAddress}: battery ${batteryLow ? 'low' : 'ok'} (${millivolts} mV)`);
            buzzer.batteryLow = batteryLow;
            this.notifyBuzzersChanged();
        }
    }

    /**
     * The buzzer tells its color with every heartbeat, so a buzzer that got another one while it was adopted shows it
     * right away
     */
    private onColor(buzzer: IUdpBuzzer, color: unknown): void {
        const normalized = BuzzerHelper.normalizeColor(color);
        if (normalized !== buzzer.color) {
            LoggerService.log(`UDP buzzer ${buzzer.macAddress}: color ${normalized ?? 'none'}`);
            buzzer.color = normalized;
            this.notifyBuzzersChanged();
        }
    }

    private static isValidPort(port: unknown): port is number {
        return Number.isInteger(port) && (port as number) > 0 && (port as number) < 65536;
    }

    /**
     * Presses that arrive within the collection window are compared by when they happened, so a press that took longer
     * over the WiFi still wins. The buzzers synchronize their clocks with the server's (STATE.st) and send the time of
     * the press on it; with a window of 0 the first press that arrives wins. A time after the press arrived, or before
     * it could have been sent, comes from a clock that is off; then the press counts as made when it arrived, so such a
     * buzzer can't win every press.
     */
    private onPress(buzzer: IUdpBuzzer, timestamp: number, arrivedAt: number): void {
        let time = Number.MAX_SAFE_INTEGER;
        if (Number.isFinite(timestamp)) {
            const isPlausible = timestamp <= arrivedAt && timestamp >= arrivedAt - UdpBuzzerService.MAX_PRESS_DELAY_IN_US;
            time = isPlausible ? timestamp : arrivedAt;
        }
        if (!this.presses.has(buzzer.id) || time < this.presses.get(buzzer.id)) {
            this.presses.set(buzzer.id, time);
        }
        const windowInMS = ConfigService.get().udpBuzzer.pressCollectionWindowInMS;
        if (windowInMS <= 0) {
            this.resolvePresses();
        } else if (this.pressWindowTimer == null) {
            this.pressWindowTimer = setTimeout(() => this.resolvePresses(), windowInMS);
        }
    }

    private resolvePresses(): void {
        this.pressWindowTimer = null;
        // a Map keeps the order of arrival, which stays for presses at the same time
        const buzzerIds = [...this.presses.entries()].sort((a, b) => a[1] - b[1]).map(([id]) => id);
        this.presses.clear();
        if (buzzerIds.length === 0) {
            return;
        }
        for (const callback of this.onPressCallbacks) {
            try {
                callback(buzzerIds);
            } catch (e) {
                LoggerService.error(`Could not handle the press of UDP buzzers ${buzzerIds.join(', ')}`, e);
            }
        }
    }

    private markTimedOutBuzzersOffline(): void {
        const timeoutInMS = ConfigService.get().udpBuzzer.heartbeatTimeoutInMS;
        let changed = false;
        for (const buzzer of this.buzzers.values()) {
            if (buzzer.online && Date.now() - buzzer.lastSeen > timeoutInMS) {
                LoggerService.log(`UDP buzzer ${buzzer.macAddress} is offline`);
                buzzer.online = false;
                changed = true;
            }
        }
        if (changed) {
            this.notifyBuzzersChanged();
        }
    }

    private notifyBuzzersChanged(): void {
        this.onBuzzersChangedCallbacks.forEach(callback => callback());
    }

    /**
     * The server's clock in µs, which the buzzers synchronize theirs with. It only counts up (unlike Date.now(), which
     * changes when the box gets the time from the master, see ClockService).
     */
    private now(): number {
        const [seconds, nanoseconds] = process.hrtime(this.startTime);
        return seconds * 1000000 + Math.floor(nanoseconds / 1000);
    }

    private sendState(buzzer: IUdpBuzzer, answer: {ack?: number, pa?: number} = {}): void {
        const packet: IStatePacket = {t: EUdpPacketType.STATE, ...this.stateProvider(buzzer.id), st: this.now(), ...answer};
        this.socket.send(Buffer.from(JSON.stringify(packet)), buzzer.port, buzzer.ip, err => {
            if (err) {
                LoggerService.warn(`Could not send the state to UDP buzzer ${buzzer.macAddress} at ${buzzer.ip}:${buzzer.port}: ${err}`);
            }
        });
    }
}
