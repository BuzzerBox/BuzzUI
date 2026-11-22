import {Buffer} from 'buffer';
import {BoxSettingsHelper} from '../../../shared/shared';
import {ANALOG_BUZZERS_SETTING, hasAnalogBuzzers} from '../../../shared/extensions/serial-buzzers/analog-buzzers.setting';
import {ConfigService} from '../../services/config.service';
import {LoggerService} from '../../services/logger.service';
import {IExtensionHost, IServerExtension} from '../server-extension';
import {MicroControllerSerialAdapter} from './micro-controller-serial.adapter';
import {SerialPortService} from './serial-port.service';

/**
 * The box's analog buzzers: wired to its buzzer ports and read by its microcontroller, which locks them in hardware
 * and tells the Pi over the serial port (config.json's "serial"). It sends one byte per event: a buzzer's "byte" from
 * config.json's "buzzers", or "softReleaseByte" for the release button. The server releases the microcontroller's
 * lock whenever the buzzers are released anywhere else. A box with ANALOG_BUZZERS=no in buzzerbox.txt has none.
 */
export class SerialBuzzersExtension implements IServerExtension {
    public readonly id = 'serial-buzzers';
    private host: IExtensionHost;

    public start(host: IExtensionHost): void {
        this.host = host;
        BoxSettingsHelper.register(ANALOG_BUZZERS_SETTING);
        if (!hasAnalogBuzzers(host.getBoxSetting(ANALOG_BUZZERS_SETTING.key))) {
            LoggerService.log('This box has no analog buzzers (ANALOG_BUZZERS=no), only the wireless ones are offered');
            return;
        }
        host.enableBoxBuzzers();
        if (!ConfigService.get().serial.enabled) {
            // e.g. in the test environment, where buzzers come from browser keypresses only
            LoggerService.warn('Serial port is disabled in the config');
            return;
        }
        SerialPortService.get().addOnDataInCallback(this.onDataIn.bind(this));
        host.onLockReleased(origin => {
            // a release on the box is already known to its microcontroller
            if (origin !== this.id) {
                MicroControllerSerialAdapter.sendSerialCommandReleaseLock();
            }
        });
    }

    private onDataIn(data: Buffer): void {
        // one chunk of data can hold several bytes, e.g. when two buzzers were pressed right after each other
        for (const byte of data) {
            // like a broken packet, a failing buzzer press must not take the server down
            try {
                this.onByteIn(byte);
            } catch (e) {
                LoggerService.error(`Could not handle serial byte ${byte}`, e);
            }
        }
    }

    private onByteIn(byte: number): void {
        const config = ConfigService.get();
        // the config writes the bytes as their hex digits, e.g. 0x31 as 31
        const input = Number(byte.toString(16).padStart(2, '0'));
        if (input === config.softReleaseByte) {
            this.host.releaseFromBox(this.id);
            return;
        }
        // the box's buzzers are those of the config, in its order
        const index = config.buzzers.findIndex(buzzer => buzzer.byte === input);
        const buzzer = index < 0 ? undefined : this.host.getBoxBuzzers()[index];
        if (buzzer == null) {
            LoggerService.error(`no buzzer for serial byte ${byte}`);
            return;
        }
        this.host.pressBuzzer(buzzer.id);
    }
}
