import * as dgram from 'dgram';
import * as Uuid from 'uuid';
import {IBuzzer} from '../../shared/shared';
import {EUdpPacketType} from '../../shared/enums/EUdpPacketType';
import {LoggerService} from './logger.service';

// ─── Internal state ────────────────────────────────────────────────────────────

interface IDiscoveredBuzzer {
    /** Stable UUID used to match this buzzer to a team */
    id: string;
    /** MAC address of the ESP32, used as the unique hardware key */
    macAddress: string;
    ip: string;
    /** Port the ESP32 listens on for server→buzzer state packets */
    port: number;
    /** Date.now() of the most recent heartbeat */
    lastSeen: number;
    /** Optional human-readable name (can be set from outside) */
    name?: string;
}

// ─── Packet shapes ─────────────────────────────────────────────────────────────

interface IHeartbeatPacket {
    t: EUdpPacketType.HEARTBEAT;
    /** MAC address, e.g. "AA:BB:CC:DD:EE:FF" */
    id: string;
    /** Listen port for incoming server→buzzer packets (falls back to rinfo.port) */
    lp?: number;
    /** Nanosecond timestamp from the ESP32 clock */
    ts: number;
}

interface IPressPacket {
    t: EUdpPacketType.PRESS;
    id: string;
    /** Nanosecond timestamp of the physical button press (from synchronized clock) */
    ts: number;
}

interface IStatePacket {
    t: EUdpPacketType.STATE;
    /** True when this buzzer won the current round */
    selected: boolean;
    /** True when buzzer presses are being ignored */
    locked: boolean;
}

// ─── Callback types ────────────────────────────────────────────────────────────

export type UdpPressCallback = (buzzerId: string) => void;
export type UdpBuzzerListChangedCallback = (buzzers: IBuzzer[]) => void;

// ─── Service ──────────────────────────────────────────────────────────────────

export class UdpBuzzerService {
    private static instance: UdpBuzzerService;

    private socket: dgram.Socket;
    private readonly discovered = new Map<string, IDiscoveredBuzzer>();

    private readonly pressCallbacks: UdpPressCallback[] = [];
    private readonly listChangedCallbacks: UdpBuzzerListChangedCallback[] = [];

    /** Ongoing first-press collection window */
    private pressCollectionTimer: ReturnType<typeof setTimeout> | null = null;
    private pressCollection: { buzzerId: string; timestamp: number }[] = [];

    private heartbeatTimeoutMs: number;
    private pressCollectionWindowMs: number;

    private constructor() {}

    public static get(): UdpBuzzerService {
        if (!this.instance) {
            this.instance = new UdpBuzzerService();
        }
        return this.instance;
    }

    // ─── Public API ─────────────────────────────────────────────────────────────

    public start(
        listenPort: number,
        heartbeatTimeoutMs: number,
        pressCollectionWindowMs: number,
    ): void {
        this.heartbeatTimeoutMs = heartbeatTimeoutMs;
        this.pressCollectionWindowMs = pressCollectionWindowMs;

        this.socket = dgram.createSocket('udp4');
        this.socket.on('message', this.onMessage.bind(this));
        this.socket.on('error', (err) => LoggerService.error(`UDP socket error: ${err}`));
        this.socket.bind(listenPort, () => {
            LoggerService.log(`UDP Buzzer Service listening on port ${listenPort}`);
        });

        // Periodically evict buzzers that stopped heartbeating
        setInterval(this.cleanupTimedOutBuzzers.bind(this), 1000);
    }

    public addPressCallback(callback: UdpPressCallback): void {
        this.pressCallbacks.push(callback);
    }

    public addListChangedCallback(callback: UdpBuzzerListChangedCallback): void {
        this.listChangedCallbacks.push(callback);
    }

    /** Returns all currently online UDP buzzers as IBuzzer entries */
    public getOnlineBuzzers(): IBuzzer[] {
        return Array.from(this.discovered.values()).map(b => this.toIBuzzer(b));
    }

    /**
     * Sends a STATE packet to every known UDP buzzer.
     * @param selectedBuzzerId UUID of the buzzer that won (null = nobody selected)
     * @param locked           Whether buzzer presses are currently locked
     */
    public sendStateToAll(selectedBuzzerId: string | null, locked: boolean): void {
        for (const buzzer of this.discovered.values()) {
            const packet: IStatePacket = {
                t: EUdpPacketType.STATE,
                selected: buzzer.id === selectedBuzzerId,
                locked,
            };
            this.sendTo(buzzer, packet);
        }
    }

    // ─── Internal handlers ───────────────────────────────────────────────────────

    private onMessage(msg: Buffer, rinfo: dgram.RemoteInfo): void {
        let packet: IHeartbeatPacket | IPressPacket;
        try {
            packet = JSON.parse(msg.toString());
        } catch {
            LoggerService.warn(`UDP: could not parse packet from ${rinfo.address}: ${msg}`);
            return;
        }

        switch (packet.t) {
            case EUdpPacketType.HEARTBEAT:
                this.handleHeartbeat(packet as IHeartbeatPacket, rinfo);
                break;
            case EUdpPacketType.PRESS:
                this.handlePress(packet as IPressPacket);
                break;
            default:
                LoggerService.warn(`UDP: unknown packet type "${(packet as any).t}" from ${rinfo.address}`);
        }
    }

    private handleHeartbeat(packet: IHeartbeatPacket, rinfo: dgram.RemoteInfo): void {
        const listenPort = packet.lp ?? rinfo.port;
        const existing = this.discovered.get(packet.id);
        if (existing) {
            existing.lastSeen = Date.now();
            existing.ip = rinfo.address;
            existing.port = listenPort;
        } else {
            LoggerService.log(`UDP: new buzzer discovered — MAC=${packet.id} IP=${rinfo.address}:${listenPort}`);
            this.discovered.set(packet.id, {
                id: Uuid.v4(),
                macAddress: packet.id,
                ip: rinfo.address,
                port: listenPort,
                lastSeen: Date.now(),
            });
            this.notifyListChanged();
        }
    }

    private handlePress(packet: IPressPacket): void {
        const buzzer = this.discovered.get(packet.id);
        if (!buzzer) {
            LoggerService.warn(`UDP: PRESS from unknown MAC=${packet.id} — ignoring`);
            return;
        }

        LoggerService.log(`UDP: PRESS from MAC=${packet.id} ts=${packet.ts}ns`);
        this.pressCollection.push({ buzzerId: buzzer.id, timestamp: packet.ts });

        if (!this.pressCollectionTimer) {
            this.pressCollectionTimer = setTimeout(
                this.resolvePressCollection.bind(this),
                this.pressCollectionWindowMs,
            );
        }
    }

    /** At the end of the collection window, pick the press with the lowest timestamp */
    private resolvePressCollection(): void {
        this.pressCollectionTimer = null;
        if (this.pressCollection.length === 0) return;

        const winner = this.pressCollection.reduce((a, b) =>
            a.timestamp <= b.timestamp ? a : b,
        );
        this.pressCollection = [];

        LoggerService.log(`UDP: winner determined — buzzerId=${winner.buzzerId} ts=${winner.timestamp}ns`);
        for (const cb of this.pressCallbacks) {
            cb(winner.buzzerId);
        }
    }

    private cleanupTimedOutBuzzers(): void {
        const now = Date.now();
        let changed = false;
        for (const [mac, buzzer] of this.discovered.entries()) {
            if (now - buzzer.lastSeen > this.heartbeatTimeoutMs) {
                LoggerService.log(`UDP: buzzer timed out — MAC=${mac}`);
                this.discovered.delete(mac);
                changed = true;
            }
        }
        if (changed) {
            this.notifyListChanged();
        }
    }

    private notifyListChanged(): void {
        const buzzers = this.getOnlineBuzzers();
        for (const cb of this.listChangedCallbacks) {
            cb(buzzers);
        }
    }

    private sendTo(buzzer: IDiscoveredBuzzer, packet: IStatePacket): void {
        const msg = Buffer.from(JSON.stringify(packet));
        this.socket.send(msg, buzzer.port, buzzer.ip, (err) => {
            if (err) {
                LoggerService.warn(`UDP: failed to send STATE to ${buzzer.ip}:${buzzer.port} — ${err}`);
            }
        });
    }

    private toIBuzzer(b: IDiscoveredBuzzer): IBuzzer {
        return {
            id: b.id,
            name: b.name ?? b.macAddress,
            keyBind: '',
            byteBind: '',
            buzzerType: 'udp',
            udpIp: b.ip,
            udpPort: b.port,
        };
    }
}
