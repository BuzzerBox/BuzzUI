import {promises as fs} from 'fs';
import * as fsSync from 'fs';
import path from 'path';
import {execFile} from 'child_process';
import crypto from 'crypto';
import {BoxSettingsHelper, EPacketTypes, IBoxSetting, IBoxSettingsPacket, IBoxSshKey} from '../../shared/shared';
import {ConfigService} from './config.service';
import {LoggerService} from './logger.service';
import {BoxHardwareService} from './box-hardware.service';

/**
 * The box's settings in buzzerbox.txt on its boot partition (see BoxSettingsHelper), which the master shows. It may
 * change them only if the file allows it (BoxSettingsHelper.EDIT_KEY). The server can't write the boot partition, so
 * on the box a root helper does (install/.assets/scripts/buzzerbox-settings.sh, through sudo), which checks everything
 * again. The box applies the settings when it starts, so the master can restart it through the same helper.
 * The same goes for the public SSH keys in buzzerbox-ssh-keys.txt (provisioning/roles/ssh), which the helper applies
 * right away.
 *
 * What the box applied at its start is in boxSettingsFile (/etc/buzzerbox/box.conf, written by buzzerbox-apply-settings),
 * which is read once, when the server starts: whether the box has analog buzzers. Without that file (an image from
 * before it, or a computer in development), the box has them.
 */
export class BoxSettingsService {
    private static instance: BoxSettingsService;
    private static readonly COMMAND_TIMEOUT_IN_MS = 15000;

    private readonly config = ConfigService.get().boxSettings;
    // what the box applied at its start, see the class comment
    private readonly appliedSettings: Map<string, string>;

    private constructor() {
        const file = ConfigService.get().boxSettingsFile;
        let content = '';
        try {
            content = file ? fsSync.readFileSync(file, 'utf8') : '';
        } catch (e) {
            LoggerService.log(`No box settings in ${file}, using the defaults`);
        }
        this.appliedSettings = BoxSettingsService.parse(content);
        if (!this.hasAnalogBuzzers()) {
            LoggerService.log('This box has no analog buzzers (ANALOG_BUZZERS=no), only the wireless ones are offered');
        }
    }

    /**
     * KEY=value lines, as buzzerbox-apply-settings writes them, see BoxSettingsHelper.parse
     */
    public static parse(content: string): Map<string, string> {
        return BoxSettingsHelper.parse(content);
    }

    /**
     * Whether the box has analog buzzers, wired to its buzzer ports and read by its microcontroller on the serial port.
     * A box without them (e.g. the compact one with a touch display) offers only the wireless buzzers. This is what the
     * box applied at its start; a changed ANALOG_BUZZERS counts after the next one.
     */
    public hasAnalogBuzzers(): boolean {
        return this.appliedSettings.get('ANALOG_BUZZERS')?.toLowerCase() !== 'no';
    }

    public static get(): BoxSettingsService {
        if (this.instance == null) {
            this.instance = new BoxSettingsService();
        }
        return this.instance;
    }

    public async read(): Promise<IBoxSettingsPacket> {
        const packet: IBoxSettingsPacket = {
            packetType: EPacketTypes.BOX_SETTINGS,
            available: false,
            editable: false,
            canRestart: false,
            settings: [],
            sshAvailable: false,
            sshKeys: [],
            sshUser: this.config.sshUser,
            hardware: await BoxHardwareService.get().read()
        };
        if (!this.config.enabled) {
            return packet;
        }
        let content: string;
        try {
            content = await this.readSettingsFile();
        } catch (e) {
            LoggerService.warn(`Could not read the box's settings in ${this.config.file}`, e);
            packet.error = e?.code === 'ENOENT' ? 'Diese BuzzerBox hat keine Datei buzzerbox.txt.' : 'Die Datei buzzerbox.txt ließ sich nicht lesen.';
            return packet;
        }
        const defaults = await this.readDefaults();
        const settings = BoxSettingsHelper.parse(content);
        packet.available = true;
        packet.editable = BoxSettingsHelper.isEditEnabled(settings);
        packet.canRestart = this.config.useHelper;
        packet.settings = BoxSettingsHelper.KEYS.map(key => {
            const fileValue = settings.get(key);
            const setting: IBoxSetting = {key, value: fileValue, isDefault: false};
            if (fileValue == null || !BoxSettingsHelper.isValid(key, fileValue)) {
                setting.value = defaults.get(key) ?? '';
                setting.isDefault = true;
                if (fileValue != null) {
                    setting.invalidValue = fileValue;
                }
            }
            return setting;
        });
        // the box falls back to the default Ethernet address when it is in the WiFi's network
        const wifiAddress = packet.settings.find(s => s.key === 'SERVER_IP_ADDRESS');
        const ethernetAddress = packet.settings.find(s => s.key === 'ETHERNET_IP_ADDRESS');
        if (!ethernetAddress.isDefault && BoxSettingsHelper.isSameNetwork(wifiAddress.value, ethernetAddress.value)) {
            ethernetAddress.invalidValue = ethernetAddress.value;
            ethernetAddress.value = defaults.get('ETHERNET_IP_ADDRESS') ?? '';
            ethernetAddress.isDefault = true;
        }
        const sshKeys = await this.readSshKeys();
        if (sshKeys != null) {
            packet.sshAvailable = true;
            const active = await this.readActiveSshKeys();
            packet.sshKeys = sshKeys.map(k => ({
                type: k.type, comment: k.comment, fingerprint: k.fingerprint,
                isActive: active == null ? undefined : active.has(k.fingerprint)
            }));
        }
        return packet;
    }

    /**
     * Allows a public key to log into the box; counts right away
     * @return why it wasn't added, or null if it was
     */
    public async addSshKey(text: string): Promise<string | null> {
        if (BoxSettingsHelper.isPrivateKey(text)) {
            return 'Das ist ein privater Schlüssel. Er gehört nie auf die Box: nimm den öffentlichen (die Datei mit .pub) und verwende diesen privaten Schlüssel nicht mehr, falls ihn jemand anderes gesehen hat.';
        }
        const key = BoxSettingsService.checkSshKey(text);
        if (key == null) {
            return 'Das ist kein öffentlicher SSH-Schlüssel, den die Box annimmt (z. B. der Inhalt von ~/.ssh/id_ed25519.pub).';
        }
        return this.changeSshKeys(keys => {
            if (keys.some(k => k.fingerprint === key.fingerprint)) {
                return 'Dieser Schlüssel ist schon eingetragen.';
            }
            keys.push(key);
            return null;
        });
    }

    /**
     * @return why it wasn't removed, or null if it was
     */
    public async removeSshKey(fingerprint: string): Promise<string | null> {
        return this.changeSshKeys(keys => {
            const index = keys.findIndex(k => k.fingerprint === fingerprint);
            if (index < 0) {
                return 'Dieser Schlüssel ist nicht eingetragen.';
            }
            keys.splice(index, 1);
            return null;
        });
    }

    /**
     * Writes the keys file with the keys as the change leaves them, like save() only if the settings allow it
     * @param change changes the keys, or returns why it can't
     */
    private async changeSshKeys(change: (keys: (IBoxSshKey & {line: string})[]) => string | null): Promise<string | null> {
        const current = await this.read();
        if (!current.available || !current.sshAvailable) {
            return 'Diese BuzzerBox hat keine Datei buzzerbox-ssh-keys.txt.';
        }
        if (!current.editable) {
            return `Die SSH-Schlüssel dürfen nur geändert werden, wenn buzzerbox.txt ${BoxSettingsHelper.EDIT_KEY}=true enthält.`;
        }
        const keys = await this.readSshKeys();
        const reason = change(keys);
        if (reason != null) {
            return reason;
        }
        LoggerService.log(`Changing the box's SSH keys to ${keys.map(k => k.fingerprint).join(', ') || 'none'}`);
        try {
            const lines = keys.map(k => k.line);
            if (this.config.useHelper) {
                await this.run(this.config.writeSshKeysCommand, lines.map(line => line + '\n').join(''));
            } else {
                const content = await fs.readFile(this.config.sshKeysFile, 'utf8');
                await this.writeFile(this.config.sshKeysFile, BoxSettingsHelper.applySshKeys(content, lines));
            }
        } catch (e) {
            LoggerService.error('Could not change the box\'s SSH keys', e);
            return `Die SSH-Schlüssel ließen sich nicht speichern: ${e?.message ?? e}`;
        }
        return null;
    }

    /**
     * The valid keys of the keys file, or null if there is none; lines the box ignores are left out as well
     */
    private async readSshKeys(): Promise<(IBoxSshKey & {line: string})[] | null> {
        if (!this.config.sshKeysFile) {
            return null;
        }
        let content: string;
        try {
            content = await fs.readFile(this.config.sshKeysFile, 'utf8');
        } catch (e) {
            if (e?.code === 'ENOENT' && ConfigService.isDevMode()) {
                content = '# SSH access to this BuzzerBox (dev)\n';
                await this.writeFile(this.config.sshKeysFile, content);
            } else {
                if (e?.code !== 'ENOENT') {
                    LoggerService.warn(`Could not read the SSH keys in ${this.config.sshKeysFile}`, e);
                }
                return null;
            }
        }
        const keys: (IBoxSshKey & {line: string})[] = [];
        for (const line of content.split(/\r?\n/)) {
            const key = line.trim().startsWith('#') ? null : BoxSettingsService.checkSshKey(line);
            if (key != null && !keys.some(k => k.fingerprint === key.fingerprint)) {
                keys.push(key);
            }
        }
        return keys;
    }

    /**
     * The fingerprints of the keys the box took at its start, or null if that is unknown
     */
    private async readActiveSshKeys(): Promise<Set<string> | null> {
        if (!this.config.activeSshKeysFile) {
            return null;
        }
        let content = '';
        try {
            content = await fs.readFile(this.config.activeSshKeysFile, 'utf8');
        } catch (e) {
            // the box removes the file when there are no keys
            if (e?.code !== 'ENOENT') {
                return null;
            }
        }
        return new Set(content.split(/\r?\n/).map(line => BoxSettingsService.checkSshKey(line)?.fingerprint).filter(f => f != null));
    }

    /**
     * The key of a line if it is a valid public key: the base64 part must hold the same type it is written with, as
     * ssh-keygen checks it. The fingerprint is the one ssh-keygen -l shows.
     */
    private static checkSshKey(text: string): (IBoxSshKey & {line: string}) | null {
        const parsed = BoxSettingsHelper.parseSshKey(text);
        if (parsed == null) {
            return null;
        }
        const blob = Buffer.from(parsed.key, 'base64');
        if (blob.length < 4 || blob.toString('base64') !== parsed.key) {
            return null;
        }
        const typeLength = blob.readUInt32BE(0);
        if (typeLength > blob.length - 4 || blob.toString('latin1', 4, 4 + typeLength) !== parsed.type || blob.length < 4 + typeLength + 16) {
            return null;
        }
        const fingerprint = 'SHA256:' + crypto.createHash('sha256').update(blob).digest('base64').replace(/=+$/, '');
        const line = parsed.comment ? `${parsed.type} ${parsed.key} ${parsed.comment}` : `${parsed.type} ${parsed.key}`;
        return {type: parsed.type, comment: parsed.comment, fingerprint, line};
    }

    /**
     * Writes the values into buzzerbox.txt; they count from the box's next start
     * @return why they were not saved, or null if they were
     */
    public async save(values: Record<string, string>): Promise<string | null> {
        const current = await this.read();
        if (!current.available) {
            return current.error ?? 'Die Einstellungen der BuzzerBox sind auf diesem Server nicht verfügbar.';
        }
        if (!current.editable) {
            return `Die Einstellungen dürfen nur geändert werden, wenn buzzerbox.txt ${BoxSettingsHelper.EDIT_KEY}=true enthält.`;
        }
        const keys = Object.keys(values ?? {});
        if (keys.length === 0) {
            return null;
        }
        for (const key of keys) {
            if (!BoxSettingsHelper.KEYS.includes(key)) {
                return `Die Einstellung ${key} lässt sich nicht ändern.`;
            }
            if (typeof values[key] !== 'string' || !BoxSettingsHelper.isValid(key, values[key])) {
                return `Der Wert von ${key} ist ungültig.`;
            }
        }
        const valueOf = (key: string) => values[key] ?? current.settings.find(s => s.key === key).value;
        if (BoxSettingsHelper.isSameNetwork(valueOf('SERVER_IP_ADDRESS'), valueOf('ETHERNET_IP_ADDRESS'))) {
            return 'Die Adressen im WLAN und am Ethernet-Anschluss müssen in verschiedenen Netzen liegen.';
        }
        LoggerService.log(`Saving the box's settings ${keys.join(', ')}`);
        try {
            if (this.config.useHelper) {
                const input = keys.map(key => `${key}=${values[key]}\n`).join('');
                await this.run(this.config.writeCommand, input);
            } else {
                const content = await this.readSettingsFile();
                await this.writeSettingsFile(BoxSettingsHelper.applyChanges(content, values));
            }
        } catch (e) {
            LoggerService.error('Could not save the box\'s settings', e);
            return `Die Einstellungen ließen sich nicht speichern: ${e?.message ?? e}`;
        }
        return null;
    }

    /**
     * Restarts the box, which takes this server down as well
     * @return why it can't, or null if the restart was started
     */
    public async restart(): Promise<string | null> {
        if (!this.config.enabled || !this.config.useHelper) {
            return 'Diese BuzzerBox kann nicht von hier aus neu gestartet werden.';
        }
        LoggerService.log('Restarting the box for its settings');
        try {
            await this.run(this.config.restartCommand);
        } catch (e) {
            LoggerService.error('Could not restart the box', e);
            return `Die BuzzerBox ließ sich nicht neu starten: ${e?.message ?? e}`;
        }
        return null;
    }

    private async readSettingsFile(): Promise<string> {
        try {
            return await fs.readFile(this.config.file, 'utf8');
        } catch (e) {
            // in dev there is no boot partition: start with the defaults, editable, as the box writes them when the file is missing
            if (e?.code === 'ENOENT' && ConfigService.isDevMode()) {
                const content = BoxSettingsHelper.applyChanges('', {...BoxSettingsHelper.DEFAULTS, [BoxSettingsHelper.EDIT_KEY]: 'true'});
                await this.writeSettingsFile(content);
                return content;
            }
            throw e;
        }
    }

    private async writeSettingsFile(content: string): Promise<void> {
        await this.writeFile(this.config.file, content);
    }

    private async writeFile(file: string, content: string): Promise<void> {
        await fs.mkdir(path.dirname(file), {recursive: true});
        await fs.writeFile(file + '.tmp', content, 'utf8');
        await fs.rename(file + '.tmp', file);
    }

    /**
     * The defaults the box falls back to for missing or invalid values
     */
    private async readDefaults(): Promise<Map<string, string>> {
        const defaults = new Map(Object.entries(BoxSettingsHelper.DEFAULTS));
        if (this.config.defaultsFile) {
            try {
                BoxSettingsHelper.parse(await fs.readFile(this.config.defaultsFile, 'utf8')).forEach((value, key) => defaults.set(key, value));
            } catch (e) {
                LoggerService.warn(`Could not read the default settings in ${this.config.defaultsFile}`, e);
            }
        }
        return defaults;
    }

    /**
     * Runs a command, giving it the input on stdin; rejects with what it wrote to stderr if it fails
     */
    private run(commandLine: string[], input?: string): Promise<void> {
        const [command, ...args] = commandLine;
        return new Promise<void>((resolve, reject) => {
            const child = execFile(command, args, {timeout: BoxSettingsService.COMMAND_TIMEOUT_IN_MS}, (error, stdout, stderr) => {
                if (error) {
                    reject(new Error((stderr || error.message).trim()));
                } else {
                    resolve();
                }
            });
            child.stdin.end(input ?? '');
        });
    }
}
