/**
 * The time to save games with. The box has no battery-backed clock and, as a WiFi access point, no internet to set its
 * clock, so after a reboot it may be days behind. The master's device knows the time; it sends it when registering.
 */
export class ClockService {
    private static instance: ClockService;
    private offsetInMs = 0;

    private constructor() {
    }

    public static get(): ClockService {
        if (this.instance == null) {
            this.instance = new ClockService();
        }
        return this.instance;
    }

    /**
     * @param clientTime the master's Date.now()
     */
    public setClientTime(clientTime: unknown): void {
        if (typeof clientTime === 'number' && Number.isFinite(clientTime)) {
            this.offsetInMs = clientTime - Date.now();
        }
    }

    public now(): Date {
        return new Date(Date.now() + this.offsetInMs);
    }

    public nowAsIsoString(): string {
        return this.now().toISOString();
    }
}
