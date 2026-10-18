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
}
