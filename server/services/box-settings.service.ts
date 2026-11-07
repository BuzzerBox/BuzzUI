import * as fs from 'fs';
import {ConfigService} from './config.service';
import {LoggerService} from './logger.service';

/**
 * The settings of this box from buzzerbox.txt on its boot partition, which buzzerbox-apply-settings writes to
 * boxSettingsFile on every boot. They are read once, when the server starts. Without the file (an image from before
 * these settings, or a computer in development), the box has the defaults.
 */
export class BoxSettingsService {
    private static instance: BoxSettingsService;
    private readonly settings: Map<string, string>;

    private constructor() {
        const file = ConfigService.get().boxSettingsFile;
        let content = '';
        try {
            content = file ? fs.readFileSync(file, 'utf8') : '';
        } catch (e) {
            LoggerService.log(`No box settings in ${file}, using the defaults`);
        }
        this.settings = BoxSettingsService.parse(content);
        if (!this.hasAnalogBuzzers()) {
            LoggerService.log('This box has no analog buzzers (ANALOG_BUZZERS=no), only the wireless ones are offered');
        }
    }

    public static get(): BoxSettingsService {
        if (this.instance == null) {
            this.instance = new BoxSettingsService();
        }
        return this.instance;
    }

    /**
     * KEY=value lines, as buzzerbox-apply-settings writes them; comments and lines without "=" are skipped
     */
    public static parse(content: string): Map<string, string> {
        const settings = new Map<string, string>();
        for (const line of content.split(/\r?\n/)) {
            const index = line.indexOf('=');
            if (index > 0 && !line.trim().startsWith('#')) {
                settings.set(line.slice(0, index).trim(), line.slice(index + 1).trim());
            }
        }
        return settings;
    }

    /**
     * Whether the box has analog buzzers, wired to its buzzer ports and read by its microcontroller on the serial port.
     * A box without them (e.g. the compact one with a touch display) offers only the wireless buzzers.
     */
    public hasAnalogBuzzers(): boolean {
        return this.settings.get('ANALOG_BUZZERS')?.toLowerCase() !== 'no';
    }
}
