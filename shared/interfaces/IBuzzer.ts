import {EKeyBinds} from '../shared';

export interface IBuzzer {
    id: string;
    name?: string;
    /** Serial / keyboard keybind (empty string for UDP buzzers) */
    keyBind: string;
    /** Serial byte code (empty string for UDP buzzers) */
    byteBind: string;
    /** Distinguishes serial (config-based) from UDP (auto-discovered) buzzers */
    buzzerType?: 'serial' | 'udp';
    /** IP address of the ESP32 (UDP buzzers only) */
    udpIp?: string;
    /** UDP port the ESP32 listens on for server→buzzer state packets */
    udpPort?: number;
}
