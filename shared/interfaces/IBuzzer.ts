export interface IBuzzer {
    id: string;
    /** Of a buzzer of the box, from the config. The client names a UDP buzzer after its color, in its language. */
    name?: string;
    /** Empty for a UDP buzzer */
    keyBind: string;
    /** No longer sent: an extension that presses the box's buzzers maps its own input to them, see IExtensionHost */
    byteBind?: string;
    /**
     * 'serial' (or missing) for a buzzer of the box from the config, which browser keypresses or an extension press
     * (the name is from when only the box's microcontroller pressed them, on the serial port), 'udp' for a wireless
     * buzzer (ESP32) that the server found on the network, see BuzzerHelper
     */
    type?: 'serial' | 'udp';
    /**
     * For a UDP buzzer: whether it sent a heartbeat lately, over the WiFi or over USB. A buzzer that went offline stays
     * in the list.
     */
    online?: boolean;
    /**
     * For a UDP buzzer that is online: how the game reaches it right now. 'usb' while it is plugged into the box and plays
     * over USB (firmware 1.4.0 and later), and else 'wifi'.
     */
    connection?: 'usb' | 'wifi';
    /** For a UDP buzzer: its battery is low, see udpBuzzer.batteryLowInMV in the config */
    batteryLow?: boolean;
    /**
     * For a UDP buzzer: the charge of its battery in % (0-100), from the fuel gauge of a Feather ESP32-S3 (firmware 1.3.0
     * and later). Missing for a buzzer without one, which only tells batteryLow.
     */
    batteryPercent?: number;
    /** For a UDP buzzer: its firmware version, as its heartbeats tell */
    firmwareVersion?: string;
    /**
     * The color of the buzzer ("#rrggbb"): of a buzzer of the box as set in the config, of a UDP buzzer the color of its
     * case, which it keeps in its flash (given when it was adopted, see BuzzerHelper.CASE_COLORS). Missing if unknown.
     */
    color?: string;
}
