import {promises as fs} from 'fs';
import os from 'os';
import {IBoxHardware} from '../../shared/shared';
import versionInfo from '../../version.json';
import {LoggerService} from './logger.service';

/**
 * Tells what the box is built of, for the master's settings: the Raspberry Pi, its memory and where the system runs
 * from. Everything comes from files Linux provides to every user; on another computer (dev), most of it is missing.
 */
export class BoxHardwareService {
    private static instance: BoxHardwareService;

    private constructor() {
        // hide public constructor
    }

    public static get(): BoxHardwareService {
        if (this.instance == null) {
            this.instance = new BoxHardwareService();
        }
        return this.instance;
    }

    public async read(): Promise<IBoxHardware> {
        const hardware: IBoxHardware = {
            memoryInBytes: os.totalmem(),
            uptimeInSeconds: Math.round(os.uptime()),
            softwareVersion: versionInfo.version
        };
        try {
            const [model, serialNumber, storage, temperature, operatingSystem] = await Promise.all([
                BoxHardwareService.readText('/proc/device-tree/model'),
                BoxHardwareService.readText('/proc/device-tree/serial-number'),
                BoxHardwareService.readStorage(),
                BoxHardwareService.readText('/sys/class/thermal/thermal_zone0/temp'),
                BoxHardwareService.readOperatingSystem()
            ]);
            hardware.model = model ?? `${os.type()} ${os.arch()}`;
            // the device tree has leading zeros, which nobody writes
            hardware.serialNumber = serialNumber?.replace(/^0+(?=.)/, '');
            hardware.storage = storage;
            if (temperature != null && /^-?[0-9]+$/.test(temperature)) {
                hardware.temperatureInCelsius = Math.round(Number(temperature) / 100) / 10;
            }
            hardware.operatingSystem = operatingSystem ?? `${os.type()} ${os.release()}`;
        } catch (e) {
            LoggerService.warn('Could not read the box\'s hardware', e);
        }
        return hardware;
    }

    /**
     * The disk the system runs from: an eMMC (only on a Compute Module with one), an SD card or a USB drive
     */
    private static async readStorage(): Promise<IBoxHardware['storage'] | undefined> {
        const mounts = await BoxHardwareService.readText('/proc/mounts');
        const rootDevice = mounts?.split('\n').map(line => line.split(' ')).find(fields => fields[1] === '/')?.[0];
        if (rootDevice == null || !rootDevice.startsWith('/dev/')) {
            return undefined;
        }
        // the partition's disk: mmcblk0p2 → mmcblk0, sda2 → sda
        const partition = rootDevice.slice('/dev/'.length);
        const disk = partition.startsWith('mmcblk') ? partition.replace(/p[0-9]+$/, '') : partition.replace(/[0-9]+$/, '');
        let kind: 'emmc' | 'sd' | 'usb' | 'other' = 'other';
        if (disk.startsWith('mmcblk')) {
            // MMC for an eMMC, SD for a card
            const type = await BoxHardwareService.readText(`/sys/block/${disk}/device/type`);
            kind = type === 'MMC' ? 'emmc' : 'sd';
        } else if (disk.startsWith('sd')) {
            kind = 'usb';
        }
        const sectors = await BoxHardwareService.readText(`/sys/block/${disk}/size`);
        const storage: IBoxHardware['storage'] = {kind};
        if (sectors != null && /^[0-9]+$/.test(sectors)) {
            // always in 512-byte sectors, whatever the disk's own sector size
            storage.sizeInBytes = Number(sectors) * 512;
        }
        try {
            const stats = await fs.statfs('/');
            storage.freeInBytes = stats.bavail * stats.bsize;
        } catch (e) {
            // too old a Node.js, or not allowed
        }
        return storage;
    }

    private static async readOperatingSystem(): Promise<string | undefined> {
        const release = await BoxHardwareService.readText('/etc/os-release');
        const name = release?.split('\n').find(line => line.startsWith('PRETTY_NAME='))?.slice('PRETTY_NAME='.length);
        return name?.replace(/^"(.*)"$/, '$1');
    }

    /**
     * The file's text without the trailing newline and the NUL the device tree ends its strings with, or undefined
     */
    private static async readText(file: string): Promise<string | undefined> {
        try {
            return (await fs.readFile(file, 'utf8')).replace(/\0/g, '').trim();
        } catch (e) {
            return undefined;
        }
    }
}
