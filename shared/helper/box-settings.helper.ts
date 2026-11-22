/**
 * A setting an extension adds to the box's settings (see docs/extensions.md): its key, its default and the values it
 * takes. The box's own scripts must know it too, since they apply and write buzzerbox.txt.
 */
export interface IBoxSettingDefinition {
    key: string;
    defaultValue: string;
    isValid: (value: string) => boolean;
    // the setting it follows in KEYS, and so on the master's settings page; without one, it goes at the end
    after?: string;
}

/**
 * The box's settings in buzzerbox.txt on its boot partition: KEY=value lines, applied on every start by
 * buzzerbox-apply-settings (provisioning/roles/access_point). The rules here are the ones of its isValid(), which the
 * root helper that writes the file for the master (install/.assets/scripts/buzzerbox-settings.sh) checks again; change
 * all three together.
 */
export class BoxSettingsHelper {
    /**
     * The setting that lets the master change the others ("true"). Only the file itself can set it, so whoever can
     * write to the card decides.
     */
    public static readonly EDIT_KEY = 'EDIT_IN_MASTER';

    /**
     * The settings the master shows and can change, in the order of the file, including those extensions registered
     */
    public static readonly KEYS = [
        'WIFI_SSID',
        'WIFI_PASSPHRASE',
        'WIFI_COUNTRY_CODE',
        'WIFI_CHANNEL',
        'WIFI_ANTENNA',
        'SERVER_IP_ADDRESS',
        'ETHERNET_IP_ADDRESS',
        'SERVER_HOSTNAMES',
        'SCREEN_MODE',
        'TOUCH_DISPLAY',
        'TOUCH_DISPLAY_ROTATION',
        'TOUCH_DISPLAY_SCALE'
    ];

    /**
     * The defaults of provisioning/group_vars/all.yml, for a box (or dev) without /etc/buzzerbox/settings.defaults,
     * including those of the settings extensions registered
     */
    public static readonly DEFAULTS: Record<string, string> = {
        WIFI_SSID: 'BuzzerBoxNetwork',
        WIFI_PASSPHRASE: '12TheBuzzerBox_IncredibleNetwork34',
        WIFI_COUNTRY_CODE: 'DE',
        WIFI_CHANNEL: '8',
        WIFI_ANTENNA: 'internal',
        SERVER_IP_ADDRESS: '10.0.0.5',
        ETHERNET_IP_ADDRESS: '10.0.1.5',
        SERVER_HOSTNAMES: 'buzzer.box buzzerbox.local',
        SCREEN_MODE: '1920x1080@60',
        TOUCH_DISPLAY: 'none',
        TOUCH_DISPLAY_ROTATION: '270',
        TOUCH_DISPLAY_SCALE: 'auto',
        EDIT_IN_MASTER: 'false'
    };

    /**
     * The public keys that buzzerbox-apply-ssh-keys (provisioning/roles/ssh) takes: plain keys, no options like
     * command= in front
     */
    public static readonly SSH_KEY_TYPES = ['ssh-ed25519', 'ssh-rsa', 'ecdsa-sha2-nistp256', 'ecdsa-sha2-nistp384',
        'ecdsa-sha2-nistp521', 'sk-ssh-ed25519@openssh.com', 'sk-ecdsa-sha2-nistp256@openssh.com'];

    // the addresses the box hands out in its networks, which its own can't be one of
    private static readonly DHCP_FIRST = 50;
    private static readonly DHCP_LAST = 150;
    private static readonly OCTET = '(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9]?[0-9])';

    // the rules of the settings extensions registered, by key
    private static readonly registered = new Map<string, IBoxSettingDefinition>();

    private constructor() {
        // hide
    }

    /**
     * Adds an extension's setting, see IBoxSettingDefinition. A key that is already known is left as it is, so the
     * server and the client can both register the same definition from shared/.
     */
    public static register(definition: IBoxSettingDefinition): void {
        if (BoxSettingsHelper.KEYS.includes(definition.key) || definition.key === BoxSettingsHelper.EDIT_KEY) {
            return;
        }
        const index = definition.after == null ? -1 : BoxSettingsHelper.KEYS.indexOf(definition.after);
        BoxSettingsHelper.KEYS.splice(index < 0 ? BoxSettingsHelper.KEYS.length : index + 1, 0, definition.key);
        BoxSettingsHelper.DEFAULTS[definition.key] = definition.defaultValue;
        BoxSettingsHelper.registered.set(definition.key, definition);
    }

    /**
     * Reads KEY=value lines like buzzerbox-apply-settings: comments and empty values are skipped, spaces around keys
     * and values don't count, and a later line wins
     */
    public static parse(content: string): Map<string, string> {
        const settings = new Map<string, string>();
        for (const line of content.split(/\r?\n/)) {
            const index = line.indexOf('=');
            if (index < 0) {
                continue;
            }
            const key = line.slice(0, index).trim();
            const value = line.slice(index + 1).trim();
            if (key === '' || key.startsWith('#') || value === '') {
                continue;
            }
            settings.set(key, value);
        }
        return settings;
    }

    public static isEditEnabled(settings: Map<string, string>): boolean {
        return settings.get(BoxSettingsHelper.EDIT_KEY)?.toLowerCase() === 'true';
    }

    /**
     * Whether the box takes the value for the key, see isValid() in buzzerbox-apply-settings.sh
     */
    public static isValid(key: string, value: string): boolean {
        if (value == null || value !== value.trim() || value === '' || /[\x00-\x1f\x7f]/.test(value)) {
            return false;
        }
        switch (key) {
            case 'WIFI_SSID':
                return BoxSettingsHelper.byteLength(value) <= 32;
            case 'WIFI_PASSPHRASE':
                // printable ASCII, as [[:print:]] in the C locale
                return /^[\x20-\x7e]{8,63}$/.test(value);
            case 'WIFI_COUNTRY_CODE':
                return /^[A-Za-z]{2}$/.test(value);
            case 'WIFI_CHANNEL':
                return /^([1-9]|1[0-3])$/.test(value);
            case 'WIFI_ANTENNA':
                return /^(internal|external)$/i.test(value);
            case 'SERVER_IP_ADDRESS':
            case 'ETHERNET_IP_ADDRESS':
                return BoxSettingsHelper.isValidAddress(value);
            case 'SERVER_HOSTNAMES':
                return /^[A-Za-z0-9.-]+([ \t]+[A-Za-z0-9.-]+)*$/.test(value);
            case 'SCREEN_MODE':
                // WIDTHxHEIGHT, optionally @HZ, or the TV's own choice
                return /^auto$/i.test(value) || /^[1-9][0-9]{2,3}x[1-9][0-9]{2,3}(@[1-9][0-9]{1,2}(\.[0-9]{1,3})?)?$/.test(value);
            case 'TOUCH_DISPLAY':
                return /^(none|5inch|7inch|10inch)$/i.test(value);
            case 'TOUCH_DISPLAY_ROTATION':
                return /^(0|90|180|270)$/.test(value);
            case 'TOUCH_DISPLAY_SCALE':
                // 1 to 3 with up to two decimals, or by the display's pixel density
                return /^auto$/i.test(value) || /^(1(\.[0-9]{1,2})?|2(\.[0-9]{1,2})?|3(\.0{1,2})?)$/.test(value);
            default:
                return BoxSettingsHelper.registered.get(key)?.isValid(value) ?? false;
        }
    }

    /**
     * The WiFi and the Ethernet port each hand out addresses in their own /24 network, so the box ignores an Ethernet
     * address in the WiFi's network
     */
    public static isSameNetwork(addressA: string, addressB: string): boolean {
        return addressA.slice(0, addressA.lastIndexOf('.')) === addressB.slice(0, addressB.lastIndexOf('.'));
    }

    /**
     * The file with the values changed where they are, so its comments and order stay; keys it lacks are added at the
     * end. Every line of a key is changed, since the last one would win.
     */
    public static applyChanges(content: string, values: Record<string, string>): string {
        const remaining = new Set(Object.keys(values));
        const lines = content.split('\n').map(line => {
            const index = line.indexOf('=');
            const key = index < 0 ? '' : line.slice(0, index).trim();
            if (!Object.prototype.hasOwnProperty.call(values, key)) {
                return line;
            }
            remaining.delete(key);
            return `${key}=${values[key]}${line.endsWith('\r') ? '\r' : ''}`;
        });
        if (lines.length > 0 && lines[lines.length - 1] === '') {
            lines.pop();
        }
        for (const key of remaining) {
            lines.push(`${key}=${values[key]}`);
        }
        return lines.join('\n') + '\n';
    }

    /**
     * A line of buzzerbox-ssh-keys.txt or a pasted .pub file as type, base64 key and comment, or null if it is no
     * public key the box takes. The key's own content is checked on the server (and by ssh-keygen on the box).
     */
    public static parseSshKey(line: string): {type: string, key: string, comment: string} | null {
        const match = /^(\S+)\s+([A-Za-z0-9+/]+={0,3})(?:\s+(.*))?$/.exec((line ?? '').trim());
        if (match == null || !BoxSettingsHelper.SSH_KEY_TYPES.includes(match[1]) || /[\x00-\x1f\x7f]/.test(match[3] ?? '')) {
            return null;
        }
        return {type: match[1], key: match[2], comment: (match[3] ?? '').trim()};
    }

    /**
     * Whether pasted text holds a private key, which must never be put onto the card
     */
    public static isPrivateKey(text: string): boolean {
        return /PRIVATE KEY/.test(text ?? '');
    }

    /**
     * The keys file with the keys replaced: its comments stay, key lines go, and the keys follow at the end
     */
    public static applySshKeys(content: string, keys: string[]): string {
        const kept = content.split('\n').map(line => line.replace(/\r$/, ''))
            .filter(line => line.trim() === '' || line.trim().startsWith('#'));
        while (kept.length > 0 && kept[kept.length - 1].trim() === '') {
            kept.pop();
        }
        return [...kept, ...(kept.length > 0 && keys.length > 0 ? [''] : []), ...keys].join('\n') + '\n';
    }

    /**
     * One of the box's own addresses: not .0 or .255, and outside the addresses it hands out
     */
    private static isValidAddress(value: string): boolean {
        const octet = BoxSettingsHelper.OCTET;
        if (!new RegExp(`^${octet}\\.${octet}\\.${octet}\\.${octet}$`).test(value)) {
            return false;
        }
        const last = Number(value.slice(value.lastIndexOf('.') + 1));
        return last >= 1 && last <= 254 && (last < BoxSettingsHelper.DHCP_FIRST || last > BoxSettingsHelper.DHCP_LAST);
    }

    private static byteLength(value: string): number {
        return new TextEncoder().encode(value).length;
    }
}
