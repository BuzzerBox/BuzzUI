import {IBuzzer} from '../interfaces/IBuzzer';
import {ICaseColor} from '../interfaces/ICaseColor';
import {VersionHelper} from './version.helper';

export class BuzzerHelper {
    private static readonly UDP_ID_PREFIX = 'udp:';
    private static readonly COLOR = /^#[0-9a-f]{6}$/i;
    private static readonly FIRST_FIRMWARE_WITH_CASE_COLOR = '1.2.0';

    /**
     * The colors the cases of the wireless buzzers come in, which the master chooses from when adopting one. Red and
     * green are left out, since they stand for wrong and right answers on the screens.
     */
    public static readonly CASE_COLORS: ICaseColor[] = [
        {color: '#fb8c00', name: 'Orange', adjective: 'Oranger'},
        {color: '#fdd835', name: 'Gelb', adjective: 'Gelber'},
        {color: '#00acc1', name: 'Türkis', adjective: 'Türkiser'},
        {color: '#1e88e5', name: 'Blau', adjective: 'Blauer'},
        {color: '#8e24aa', name: 'Lila', adjective: 'Lila'},
        {color: '#ec407a', name: 'Pink', adjective: 'Pinker'},
        {color: '#ffffff', name: 'Weiß', adjective: 'Weißer'},
        {color: '#000000', name: 'Schwarz', adjective: 'Schwarzer'}
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
     * The name the master sees: after the color of its case, e.g. "Blauer Wireless Buzzer", or else the end of the MAC
     * address, which tells the buzzers apart
     * @param withMacAddress also for a buzzer with a color, when another one has the same
     */
    public static makeUdpBuzzerName(macAddress: string, color?: string, withMacAddress = false): string {
        const macEnd = macAddress.toUpperCase().slice(-5);
        const caseColor = BuzzerHelper.getCaseColor(color);
        if (caseColor == null) {
            return 'Funkbuzzer ' + macEnd;
        }
        const name = caseColor.adjective + ' Wireless Buzzer';
        return withMacAddress ? `${name} (${macEnd})` : name;
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
        return BuzzerHelper.getCaseColor(color)?.name;
    }

    public static getCaseColor(color: string): ICaseColor | undefined {
        const normalized = BuzzerHelper.normalizeColor(color);
        return BuzzerHelper.CASE_COLORS.find(caseColor => caseColor.color === normalized);
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
