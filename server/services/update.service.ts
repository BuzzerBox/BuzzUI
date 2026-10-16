import {promises as fs} from 'fs';
import path from 'path';
import crypto from 'crypto';
import {execFile} from 'child_process';
import {BehaviorSubject, Observable} from 'rxjs';
import {isEqual} from 'lodash';
import {
    EPacketTypes,
    EUpdateSignatures,
    EUpdateStates,
    IUpdateBundle,
    IUpdateInfoPacket,
    IUpdateStatus,
    VersionHelper
} from '../../shared/shared';
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
    // the version starts with a digit, so it can't be "." or ".." (the helper installs to releases/<version>)
    private static readonly BUNDLE_FILE_NAME = /^buzzerbox-update-([0-9][0-9A-Za-z.+-]*)\.tar$/;
    // bundles are only looked for in this folder at the top level of a USB stick (in any case, as on FAT sticks)
    private static readonly BUNDLE_FOLDER_NAME = 'updates';
    // the result of an update is only of interest right after it
    private static readonly STATUS_MAX_AGE_IN_MS = 30 * 60 * 1000;
    private static readonly TAR_BLOCK_SIZE = 512;
    // manifest.json and manifest.sig are tiny; anything bigger is not read into memory
    private static readonly MAX_MANIFEST_SIZE = 64 * 1024;

    private readonly config = ConfigService.get().update;
    private readonly infoSubject: BehaviorSubject<IUpdateInfoPacket>;
    // the manifest and signature of each bundle, read again only when the file changes
    private manifestCache = new Map<string, {stamp: string, manifest?: Buffer, signature?: Buffer}>();
    // read once, since the server restarts with every update that could bring a new one
    private publicKey: crypto.KeyObject | undefined;
    private pollingInterval: ReturnType<typeof setInterval> | undefined;
    // a refresh waits for the USB sticks, so refreshes are run one after the other, or an older one could win
    private isRefreshing = false;
    private isRefreshRequested = false;
    // between starting the helper and it having written that it runs
    private isStarting = false;

    private constructor() {
        this.infoSubject = new BehaviorSubject<IUpdateInfoPacket>(this.makeInfo([], undefined));
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
     * Looks for bundles regularly while this is set, i.e. while the master can install updates. Otherwise the USB
     * sticks are left alone, e.g. while a game plays media from them.
     */
    public setPolling(isPolling: boolean): void {
        if (!this.config.enabled || isPolling === (this.pollingInterval != null)) {
            return;
        }
        if (isPolling) {
            this.refresh();
            this.pollingInterval = setInterval(() => this.refresh(), UpdateService.POLLING_INTERVAL_IN_MS);
        } else {
            clearInterval(this.pollingInterval);
            this.pollingInterval = undefined;
        }
    }

    /**
     * Starts installing one of the bundles that were found. The helper runs on its own, so this resolves as soon as it
     * was started.
     * @param allowUnsigned install the bundle even without a valid signature, which the master was warned about
     * @return why the installation could not be started, or null if it was
     */
    public async install(fileName: string, allowUnsigned = false): Promise<string | null> {
        if (!this.config.enabled) {
            return 'Updates are disabled on this server';
        }
        // the helper refuses a second update as well, but starting it would overwrite the status of the running one
        if (this.isStarting || this.getInfo().status?.state === EUpdateStates.RUNNING) {
            return 'Another update is being installed';
        }
        // only bundles that were found may be installed, so the master can't pass an arbitrary path
        const bundle = this.getInfo().bundles.find(b => b.fileName === fileName);
        if (bundle == null) {
            return `Unknown update bundle ${fileName}`;
        }
        const isSigned = bundle.signature === EUpdateSignatures.VALID;
        if (!isSigned && !allowUnsigned) {
            return `The update bundle ${fileName} has no valid signature`;
        }
        // The helper checks the signature again, so a bundle that was replaced in the meantime is not installed unsigned.
        const [command, ...args] = this.config.command;
        const bundlePath = path.join(this.getBundleDirectory(), fileName);
        LoggerService.log(`Installing update bundle ${bundlePath}${isSigned ? '' : ' WITHOUT A VALID SIGNATURE'}`);
        this.isStarting = true;
        try {
            return await new Promise<string | null>(resolve => {
                execFile(command, [...args, ...(isSigned ? [] : ['--allow-unsigned']), bundlePath], (error, stdout, stderr) => {
                    if (error) {
                        LoggerService.error('Could not start the update', error, stderr);
                    }
                    resolve(error ? (stderr || error.message).trim() : null);
                });
            });
        } finally {
            this.isStarting = false;
            this.refresh();
        }
    }

    private getBundleDirectory(): string {
        return this.config.bundleDirectory || ConfigService.get().fileServer.localPath;
    }

    private refresh(): void {
        if (this.isRefreshing) {
            this.isRefreshRequested = true;
            return;
        }
        this.isRefreshing = true;
        this.updateInfo()
            .catch(e => LoggerService.error('Could not look for update bundles', e))
            .finally(() => {
                this.isRefreshing = false;
                if (this.isRefreshRequested) {
                    this.isRefreshRequested = false;
                    this.refresh();
                }
            });
    }

    private async updateInfo(): Promise<void> {
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
     * Looks for bundles in the updates folder of each USB stick, i.e. in <bundle directory>/<stick>/updates
     */
    private async findBundles(): Promise<IUpdateBundle[]> {
        const fileNames: string[] = [];
        const directory = this.getBundleDirectory();
        for (const stick of await this.readDirectory(directory)) {
            if (!stick.isDirectory()) {
                continue;
            }
            for (const folder of await this.readDirectory(path.join(directory, stick.name))) {
                if (!folder.isDirectory() || folder.name.toLowerCase() !== UpdateService.BUNDLE_FOLDER_NAME) {
                    continue;
                }
                for (const entry of await this.readDirectory(path.join(directory, stick.name, folder.name))) {
                    if (entry.isFile()) {
                        fileNames.push(path.join(stick.name, folder.name, entry.name));
                    }
                }
            }
        }
        const publicKey = await this.readPublicKey();
        const bundles: IUpdateBundle[] = [];
        for (const fileName of fileNames) {
            const match = UpdateService.BUNDLE_FILE_NAME.exec(path.basename(fileName));
            if (match) {
                const version = match[1];
                bundles.push({
                    fileName,
                    version,
                    isNewer: VersionHelper.compare(version, UpdateService.getInstalledVersion()) > 0,
                    signature: await this.checkSignature(path.join(directory, fileName), publicKey)
                });
            }
        }
        const found = new Set(fileNames.map(fileName => path.join(directory, fileName)));
        [...this.manifestCache.keys()].filter(filePath => !found.has(filePath)).forEach(filePath => this.manifestCache.delete(filePath));
        // the newest version first
        return bundles.sort((a, b) => VersionHelper.compare(b.version, a.version) || a.fileName.localeCompare(b.fileName));
    }

    private async readPublicKey(): Promise<crypto.KeyObject | undefined> {
        if (this.publicKey == null) {
            try {
                this.publicKey = crypto.createPublicKey(await fs.readFile(this.config.publicKeyFile));
            } catch (e) {
                // the box has no key (yet), so signatures can't be checked
            }
        }
        return this.publicKey;
    }

    /**
     * Checks the signature of a bundle the same way the update helper does, so the master can be warned before
     * installing a bundle the helper would refuse without allowUnsigned
     */
    private async checkSignature(filePath: string, publicKey: crypto.KeyObject | undefined): Promise<EUpdateSignatures> {
        const {manifest, signature} = await this.readManifest(filePath);
        if (signature == null) {
            return EUpdateSignatures.MISSING;
        }
        if (publicKey == null) {
            return EUpdateSignatures.NO_PUBLIC_KEY;
        }
        try {
            return manifest != null && crypto.verify(null, manifest, publicKey, signature)
                ? EUpdateSignatures.VALID
                : EUpdateSignatures.INVALID;
        } catch (e) {
            return EUpdateSignatures.INVALID;
        }
    }

    private async readManifest(filePath: string): Promise<{manifest?: Buffer, signature?: Buffer}> {
        let stamp: string;
        try {
            const stat = await fs.stat(filePath);
            stamp = `${stat.size}:${stat.mtimeMs}`;
        } catch (e) {
            return {};
        }
        const cached = this.manifestCache.get(filePath);
        if (cached?.stamp === stamp) {
            return cached;
        }
        let files: Map<string, Buffer>;
        try {
            files = await this.readTarFiles(filePath, ['manifest.json', 'manifest.sig']);
        } catch (e) {
            // not a tar file, or the stick was removed meanwhile; the helper refuses such a bundle
            files = new Map();
        }
        const entry = {stamp, manifest: files.get('manifest.json'), signature: files.get('manifest.sig')};
        this.manifestCache.set(filePath, entry);
        return entry;
    }

    /**
     * Reads small files from a tar archive without reading the rest of it, i.e. the payload of a bundle
     */
    private async readTarFiles(filePath: string, names: string[]): Promise<Map<string, Buffer>> {
        const files = new Map<string, Buffer>();
        const blockSize = UpdateService.TAR_BLOCK_SIZE;
        const handle = await fs.open(filePath, 'r');
        try {
            const header = Buffer.alloc(blockSize);
            let offset = 0;
            while (files.size < names.length) {
                const {bytesRead} = await handle.read(header, 0, blockSize, offset);
                // the archive ends with empty blocks
                if (bytesRead < blockSize || header.every(byte => byte === 0)) {
                    break;
                }
                // taken as it is: the helper extracts exactly these names, so a bundle packed as ./manifest.json
                // must not look valid here
                const name = header.toString('utf8', 0, 100).split('\0')[0];
                const size = parseInt(header.toString('ascii', 124, 136).split('\0')[0].trim() || '0', 8);
                if (isNaN(size)) {
                    break;
                }
                offset += blockSize;
                if (names.includes(name) && size <= UpdateService.MAX_MANIFEST_SIZE) {
                    const content = Buffer.alloc(size);
                    await handle.read(content, 0, size, offset);
                    files.set(name, content);
                }
                offset += Math.ceil(size / blockSize) * blockSize;
            }
        } finally {
            await handle.close();
        }
        return files;
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
        let status: IUpdateStatus;
        try {
            status = JSON.parse(await fs.readFile(this.config.statusFile, 'utf8'));
        } catch (e) {
            // there was no update yet, or the file is being replaced
            return undefined;
        }
        const time = new Date(status?.time).getTime();
        if (typeof status?.state !== 'string' || isNaN(time)) {
            LoggerService.warn(`Ignoring the update status file ${this.config.statusFile}, which is not valid`);
            return undefined;
        }
        return Date.now() - time <= UpdateService.STATUS_MAX_AGE_IN_MS ? status : undefined;
    }
}
