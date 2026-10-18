/**
 * What happens with a wireless buzzer that is plugged into the box over USB, see BuzzerProvisioningService:
 * - identifying: the box asks the buzzer who it is (and wakes it up for that)
 * - detected: it answered and can be adopted
 * - no-answer: nothing answered; adopting tries again
 * - adopting: the box gives it its WiFi
 * - adopted: the buzzer has the box's WiFi and connects to it
 * - failed: adopting didn't work, see error
 */
export type TUsbBuzzerState = 'identifying' | 'detected' | 'no-answer' | 'adopting' | 'adopted' | 'failed';

/**
 * Why adopting failed: the box doesn't know its own WiFi (no settings file), the buzzer didn't answer, it refused the
 * WiFi settings, or the serial port couldn't be used
 */
export type TUsbBuzzerError = 'no-wifi-settings' | 'no-answer' | 'rejected' | 'port-error';

export interface IUsbBuzzer {
    /** The serial port, which identifies the buzzer while it is plugged in */
    path: string;
    state: TUsbBuzzerState;
    /** Once it answered */
    macAddress?: string;
    firmwareVersion?: string;
    /** The WiFi it has: what it told when it was detected, or what it was given */
    ssid?: string;
    /**
     * It has this box's WiFi and address, as it told when it was detected (buzzer firmware 1.1.0 and later), or since it
     * was adopted
     */
    isAdopted?: boolean;
    /** It talks to this server over WiFi right now (UdpBuzzerService) */
    isConnected?: boolean;
    error?: TUsbBuzzerError;
}
