import {IBoxSettingDefinition} from '../../helper/box-settings.helper';

/**
 * ANALOG_BUZZERS in buzzerbox.txt: whether the box has analog buzzers, wired to its buzzer ports and read by its
 * microcontroller on the serial port. A box without them (e.g. the compact one) offers only the wireless buzzers.
 * Registered by the serial buzzers' extension on the server and on the client.
 */
export const ANALOG_BUZZERS_SETTING: IBoxSettingDefinition = {
    key: 'ANALOG_BUZZERS',
    defaultValue: 'yes',
    isValid: value => /^(yes|no)$/i.test(value),
    after: 'WIFI_ANTENNA'
};

export function hasAnalogBuzzers(value: string | undefined): boolean {
    return value?.toLowerCase() !== 'no';
}
