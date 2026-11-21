import {IBuzzer} from '../interfaces/IBuzzer';
import {ICaseColor} from '../interfaces/ICaseColor';
import {VersionHelper} from './version.helper';

export class BuzzerHelper {
    private static readonly UDP_ID_PREFIX = 'udp:';
    private static readonly COLOR = /^#[0-9a-f]{6}$/i;
    private static readonly FIRST_FIRMWARE_WITH_CASE_COLOR = '1.2.0';
    private static readonly FIRST_FIRMWARE_WITH_USB_MODE = '1.4.0';

    /**
     * The colors the cases of the wireless buzzers come in, which the master chooses from when adopting one. Red and
     * green are left out, since they stand for wrong and right answers on the screens.
     */
    public static readonly CASE_COLORS: ICaseColor[] = [
        {color: '#fb8c00', key: 'orange'},
        {color: '#fdd835', key: 'yellow'},
        {color: '#00acc1', key: 'turquoise'},
        {color: '#1e88e5', key: 'blue'},
        {color: '#8e24aa', key: 'purple'},
        {color: '#ec407a', key: 'pink'},
        {color: '#ffffff', key: 'white'},
        {color: '#000000', key: 'black'}
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
     * The end of a UDP buzzer's MAC address, which tells buzzers of the same color (or without one) apart in their
     * names, e.g. "8F:DC". The client names the buzzers, in the master's language.
     */
    public static getMacEnd(buzzerIdOrMacAddress: string): string {
        return buzzerIdOrMacAddress.toUpperCase().slice(-5);
    }

    /**
     * "#rrggbb", in lower case; anything else is no color
     */
    public static normalizeColor(color: unknown): string | undefined {
        return typeof color === 'string' && BuzzerHelper.COLOR.test(color) ? color.toLowerCase() : undefined;
    }

    public static getCaseColor(color: string | undefined): ICaseColor | undefined {
        const normalized = BuzzerHelper.normalizeColor(color);
        return BuzzerHelper.CASE_COLORS.find(caseColor => caseColor.color === normalized);
    }

    /**
     * Whether a wireless buzzer with that firmware keeps the color of its case (firmware 1.2.0, firmware/wireless-buzzer)
     */
    public static supportsCaseColor(firmwareVersion: string): boolean {
        return typeof firmwareVersion === 'string'
            && VersionHelper.compare(firmwareVersion, BuzzerHelper.FIRST_FIRMWARE_WITH_CASE_COLOR) >= 0;
    }

    /**
     * Whether a wireless buzzer with that firmware plays over USB while it is plugged into the box (BuzzController/wireless
     * 1.4.0), see BuzzerProvisioningService
     */
    public static supportsUsbMode(firmwareVersion: string): boolean {
        return typeof firmwareVersion === 'string'
            && VersionHelper.compare(firmwareVersion, BuzzerHelper.FIRST_FIRMWARE_WITH_USB_MODE) >= 0;
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
