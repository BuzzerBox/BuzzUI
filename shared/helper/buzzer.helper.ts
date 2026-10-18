export class BuzzerHelper {
    private static readonly UDP_ID_PREFIX = 'udp:';

    private constructor() {
        // hide constructor
    }

    /**
     * A UDP buzzer's ID is made from its MAC address, so it stays the same across server restarts and savegames can
     * put their teams back on it by ID. The buzzers of the box get new IDs on every start and are found by index.
     */
    public static makeUdpBuzzerId(macAddress: string): string {
        return BuzzerHelper.UDP_ID_PREFIX + macAddress.toUpperCase();
    }

    public static isUdpBuzzerId(buzzerId: string): boolean {
        return typeof buzzerId === 'string' && buzzerId.startsWith(BuzzerHelper.UDP_ID_PREFIX);
    }
}
