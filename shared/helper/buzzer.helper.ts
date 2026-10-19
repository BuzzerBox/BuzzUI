import {IBuzzer} from '../interfaces/IBuzzer';
import {ICaseColor} from '../interfaces/ICaseColor';
import {VersionHelper} from './version.helper';

export class BuzzerHelper {
    private static readonly UDP_ID_PREFIX = 'udp:';
    private static readonly COLOR = /^#[0-9a-f]{6}$/i;
    private static readonly FIRST_FIRMWARE_WITH_CASE_COLOR = '1.2.0';

    /**
     * The colors the cases of the wireless buzzers come in, which the master chooses from when adopting one. White and
     * black are greys, so that a team in them still shows on both the light and the dark screens.
     */
    public static readonly CASE_COLORS: ICaseColor[] = [
        {color: '#e53935', name: 'Rot'},
        {color: '#fb8c00', name: 'Orange'},
        {color: '#fdd835', name: 'Gelb'},
        {color: '#43a047', name: 'Grün'},
        {color: '#00acc1', name: 'Türkis'},
        {color: '#1e88e5', name: 'Blau'},
        {color: '#8e24aa', name: 'Lila'},
        {color: '#ec407a', name: 'Pink'},
        {color: '#cfd8dc', name: 'Weiß'},
        {color: '#546e7a', name: 'Schwarz'}
    ];

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

    /**
     * The name the master sees: the end of the MAC address, which tells the buzzers apart
     */
    public static makeUdpBuzzerName(macAddress: string): string {
        return 'Funkbuzzer ' + macAddress.toUpperCase().slice(-5);
    }

    /**
     * "#rrggbb", in lower case; anything else is no color
     */
    public static normalizeColor(color: unknown): string | undefined {
        return typeof color === 'string' && BuzzerHelper.COLOR.test(color) ? color.toLowerCase() : undefined;
    }

    /**
     * The name of one of the CASE_COLORS, or undefined for another color
     */
    public static getCaseColorName(color: string): string | undefined {
        const normalized = BuzzerHelper.normalizeColor(color);
        return BuzzerHelper.CASE_COLORS.find(caseColor => caseColor.color === normalized)?.name;
    }

    /**
     * Whether a wireless buzzer with that firmware keeps the color of its case (BuzzController/wireless 1.2.0)
     */
    public static supportsCaseColor(firmwareVersion: string): boolean {
        return typeof firmwareVersion === 'string'
            && VersionHelper.compare(firmwareVersion, BuzzerHelper.FIRST_FIRMWARE_WITH_CASE_COLOR) >= 0;
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
