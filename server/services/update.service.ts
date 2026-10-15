import {promises as fs} from 'fs';
import path from 'path';
import {execFile} from 'child_process';
import {BehaviorSubject, Observable} from 'rxjs';
import {isEqual} from 'lodash';
import {EPacketTypes, EUpdateStates, IUpdateBundle, IUpdateInfoPacket, IUpdateStatus, VersionHelper} from '../../shared/shared';
import versionInfo from '../../version.json';
import {ConfigService} from './config.service';
import {LoggerService} from './logger.service';

/**
 * Finds update bundles on the USB sticks and installs them with the update helper of the box
 * (install/.assets/scripts/buzzerbox-update.sh), which replaces and restarts this server. The helper reports how the
 * update went in a status file, which this service reads again after the restart.
 */
export class UpdateService {
    private static instance: UpdateService;
    private static readonly POLLING_INTERVAL_IN_MS = 5000;
    private static readonly BUNDLE_FILE_NAME = /^buzzerbox-update-([0-9A-Za-z.+-]+)\.tar$/;
    // the result of an update is only of interest right after it
    private static readonly STATUS_MAX_AGE_IN_MS = 30 * 60 * 1000;

    private readonly config = ConfigService.get().update;
    private readonly infoSubject: BehaviorSubject<IUpdateInfoPacket>;
    // set when starting the helper failed, which it then can't write to its status file itself
    private startFailedStatus: IUpdateStatus;

    private constructor() {
        this.infoSubject = new BehaviorSubject<IUpdateInfoPacket>(this.makeInfo([], undefined));
        if (this.config.enabled) {
            this.refresh();
            setInterval(() => this.refresh(), UpdateService.POLLING_INTERVAL_IN_MS);
        }
    }

    public static get(): UpdateService {
        if (this.instance == null) {
            this.instance = new UpdateService();
        }
        return this.instance;
    }

    public static getInstalledVersion(): string {
        return versionInfo.version;
    }

    /**
     * Emits the current info and every change of it
     */
    public observeInfo(): Observable<IUpdateInfoPacket> {
        return this.infoSubject.asObservable();
    }

    public getInfo(): IUpdateInfoPacket {
        return this.infoSubject.getValue();
    }

    /**
     * Starts installing one of the bundles that were found. The helper runs on its own, so this returns as soon as it
     * was started.
     * @return why the installation could not be started, or null if it was
     */
    public install(fileName: string): string | null {
        if (!this.config.enabled) {
            return 'Updates are disabled on this server';
        }
        // only bundles that were found may be installed, so the master can't pass an arbitrary path
        if (!this.getInfo().bundles.some(bundle => bundle.fileName === fileName)) {
            return `Unknown update bundle ${fileName}`;
        }
        // a second update while one is running is refused by the helper, which also notices one that was interrupted
        const [command, ...args] = this.config.command;
        const bundlePath = path.join(this.getBundleDirectory(), fileName);
        LoggerService.log(`Installing update bundle ${bundlePath}`);
        this.startFailedStatus = undefined;
        execFile(command, [...args, bundlePath], (error, stdout, stderr) => {
            if (error) {
                LoggerService.error('Could not start the update', error, stderr);
                this.startFailedStatus = {
                    state: EUpdateStates.FAILED,
                    message: (stderr || error.message).trim(),
                    time: new Date().toISOString()
                };
            }
            this.refresh();
        });
        return null;
    }

    private getBundleDirectory(): string {
        return this.config.bundleDirectory || ConfigService.get().fileServer.localPath;
    }

    private async refresh(): Promise<void> {
        const [bundles, status] = await Promise.all([this.findBundles(), this.readStatus()]);
        const info = this.makeInfo(bundles, status);
        if (!isEqual(info, this.getInfo())) {
            this.infoSubject.next(info);
        }
    }

    private makeInfo(bundles: IUpdateBundle[], status: IUpdateStatus | undefined): IUpdateInfoPacket {
        return {
            packetType: EPacketTypes.UPDATE_INFO,
            enabled: this.config.enabled,
            installedVersion: UpdateService.getInstalledVersion(),
            bundles,
            status
        };
    }

    /**
     * Looks for bundles in the bundle directory and the directories right below it, where the USB sticks are mounted
     */
    private async findBundles(): Promise<IUpdateBundle[]> {
        const bundles: IUpdateBundle[] = [];
        const directory = this.getBundleDirectory();
        for (const entry of await this.readDirectory(directory)) {
            if (entry.isDirectory()) {
                for (const subEntry of await this.readDirectory(path.join(directory, entry.name))) {
                    this.addBundle(bundles, path.join(entry.name, subEntry.name), subEntry.isFile());
                }
            } else {
                this.addBundle(bundles, entry.name, entry.isFile());
            }
        }
        // the newest version first
        return bundles.sort((a, b) => VersionHelper.compare(b.version, a.version) || a.fileName.localeCompare(b.fileName));
    }

    private addBundle(bundles: IUpdateBundle[], fileName: string, isFile: boolean): void {
        const match = UpdateService.BUNDLE_FILE_NAME.exec(path.basename(fileName));
        if (isFile && match) {
            const version = match[1];
            bundles.push({fileName, version, isNewer: VersionHelper.compare(version, UpdateService.getInstalledVersion()) > 0});
        }
    }

    private async readDirectory(directory: string) {
        try {
            return await fs.readdir(directory, {withFileTypes: true});
        } catch (e) {
            // the directory is gone when the last USB stick was removed, and a stick may not be readable
            return [];
        }
    }

    private async readStatus(): Promise<IUpdateStatus | undefined> {
        let status: IUpdateStatus = this.startFailedStatus;
        if (status == null) {
            try {
                status = JSON.parse(await fs.readFile(this.config.statusFile, 'utf8'));
            } catch (e) {
                // there was no update yet
                return undefined;
            }
        }
        const age = Date.now() - new Date(status.time).getTime();
        return age <= UpdateService.STATUS_MAX_AGE_IN_MS ? status : undefined;
    }
}
