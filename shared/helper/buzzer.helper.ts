import {IBuzzer} from '../interfaces/IBuzzer';

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

    public static getType(buzzerId: string): IBuzzer['type'] {
        return BuzzerHelper.isUdpBuzzerId(buzzerId) ? 'udp' : 'serial';
    }

    /**
     * A game is played either with the buzzers of the box or with UDP buzzers: the box doesn't know about a press of a
     * UDP buzzer, so it would still light up its own buzzers
     */
    public static isMixed(buzzerIds: string[]): boolean {
        return new Set(buzzerIds.map(id => BuzzerHelper.getType(id))).size > 1;
    }
}
