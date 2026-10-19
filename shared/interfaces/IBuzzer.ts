import {EKeyBinds} from '../shared';

export interface IBuzzer {
    id: string;
    name?: string;
    /** Empty for a UDP buzzer */
    keyBind: string;
    /** Empty for a UDP buzzer */
    byteBind: string;
    /**
     * 'serial' (or missing) for a buzzer of the box from the config, 'udp' for a wireless buzzer (ESP32) that the
     * server found on the network, see BuzzerHelper
     */
    type?: 'serial' | 'udp';
    /** For a UDP buzzer: whether it sent a heartbeat lately. A buzzer that went offline stays in the list. */
    online?: boolean;
    /** For a UDP buzzer: its battery is low, see udpBuzzer.batteryLowInMV in the config */
    batteryLow?: boolean;
    /**
     * The color of the buzzer ("#rrggbb"): of a buzzer of the box as set in the config, of a UDP buzzer the color of its
     * case, which it keeps in its flash (given when it was adopted, see BuzzerHelper.CASE_COLORS). Missing if unknown.
     */
    color?: string;
}
