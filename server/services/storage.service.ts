import {constants as fsConstants, createWriteStream, promises as fs} from 'fs';
import path from 'path';
import {execFile} from 'child_process';
import {pipeline, Readable} from 'stream';
import {promisify} from 'util';
import {isEqual} from 'lodash';
import * as Uuid from 'uuid';
import * as tar from 'tar';
import {
    CURRENT_GAME_FORMAT_VERSION,
    FileExtensionsService,
    GameFormatHelper,
    IDirectoryTree,
    IGameBundle,
    IGameCopyResult,
    IGameDefinition,
    IGameImportResult,
    IGameInfo,
    IGameInstanceState,
    IGameStateInfo,
    IGameStorageRef,
    IGameVersionInfo,
    IMediaQuestionDefaults,
    IQuestion,
    IRound,
    IStorageEntry,
    IStorageFolder,
    IStorageLocation,
    MediaHelper,
    StorageApiHelper
} from '../../shared/shared';
import {ConfigService} from './config.service';
import {LoggerService} from './logger.service';
import {ClockService} from './clock.service';

const pipelineAsync = promisify(pipeline);

/**
 * Why a storage operation failed, with the HTTP status code the storage API answers with
 */
export class StorageError extends Error {
    constructor(public readonly status: number, message: string) {
        super(message);
    }
}

interface IResolvedLocation {
    location: IStorageLocation;
    gamesRoot: string;
    /**
     * Only for USB sticks: the stick, with its other media
     */
    stickRoot?: string;
}

interface IGameDirectories {
    root: string;
    versions: string;
    states: string;
    media: string;
}

/**
 * Keeps the games on the box and on the USB sticks, see StorageApiHelper for the layout.
 *
 * The box keeps its games in "<config.storage.boxPath>/games". Every folder in config.storage.usbPath (by default the
 * media folder, where the sticks are mounted) is a USB stick, which keeps its games in
 * StorageApiHelper.GAMES_FOLDER_ON_USB. The other media on a stick can be copied into a game.
 */
export class StorageService {
    private static instance: StorageService;
    private static readonly MAX_JSON_SIZE_IN_BYTES = 20 * 1024 * 1024;
    private static readonly LATEST = 'latest';
    private static readonly DOWNLOAD_TICKET_LIFETIME_IN_MS = 60 * 1000;
    private static readonly NUMBERING_FILE = 'numbering.json';
    // what an archive of a game holds, see createGameArchive
    private static readonly ARCHIVE_FOLDERS = ['versions', 'states', StorageApiHelper.GAME_MEDIA_FOLDER];

    private readonly config = ConfigService.get();
    private accessToken: string | null = null;
    // what each download ticket may download, see issueDownloadTicket
    private readonly downloadTickets = new Map<string, {locationId: string, gameName: string, expiresAt: number}>();
    // the game that is being played, which can't be deleted meanwhile
    private activeGame: IGameStorageRef | null = null;

    private constructor() {
    }

    public static get(): StorageService {
        if (this.instance == null) {
            this.instance = new StorageService();
        }
        return this.instance;
    }

    public static getMaxJsonSize(): number {
        return this.MAX_JSON_SIZE_IN_BYTES;
    }

    // ---- access ----

    /**
     * A new token for the master that just registered; the previous one is no longer valid
     */
    public issueAccessToken(): string {
        this.accessToken = Uuid.v4();
        return this.accessToken;
    }

    public revokeAccessToken(): void {
        this.accessToken = null;
    }

    public isValidAccessToken(token: unknown): boolean {
        return this.accessToken != null && token === this.accessToken;
    }

    /**
     * A ticket for the browser to download a game's archive with, since it can't send the token header for a download.
     * It is only good for one download of this game, and only for a minute, but survives the master's connection
     * dropping, which some browsers do as soon as they leave the page for the download.
     */
    public issueDownloadTicket(locationId: string, gameName: string): string {
        const ticket = Uuid.v4();
        this.downloadTickets.set(ticket, {locationId, gameName, expiresAt: Date.now() + StorageService.DOWNLOAD_TICKET_LIFETIME_IN_MS});
        return ticket;
    }

    /**
     * Whether the ticket allows downloading this game; it can't be used again afterwards
     */
    public redeemDownloadTicket(ticket: unknown, locationId: string, gameName: string): boolean {
        const now = Date.now();
        [...this.downloadTickets].filter(([, entry]) => entry.expiresAt < now).forEach(([key]) => this.downloadTickets.delete(key));
        const entry = typeof ticket === 'string' ? this.downloadTickets.get(ticket) : undefined;
        if (entry == null || entry.locationId !== locationId || entry.gameName !== gameName) {
            return false;
        }
        this.downloadTickets.delete(ticket as string);
        return true;
    }

    public setActiveGame(ref: IGameStorageRef | null): void {
        this.activeGame = ref;
    }

    // ---- locations ----

    /**
     * The folder the box's games are in, which is served as StorageApiHelper.BOX_MEDIA_FOLDER below the media URL
     */
    public getBoxGamesPath(): string {
        return path.join(path.resolve(this.config.storage.boxPath), 'games');
    }

    private getUsbPath(): string {
        return path.resolve(this.config.storage.usbPath || this.config.fileServer.localPath);
    }

    public async getLocations(): Promise<IStorageLocation[]> {
        const ids = [StorageApiHelper.BOX_LOCATION_ID, ...(await this.getUsbStickNames()).map(name => StorageApiHelper.makeUsbLocationId(name))];
        const locations = await Promise.all(ids.map(id => this.resolveLocation(id).then(resolved => resolved.location, () => null)));
        return locations.filter(location => location != null);
    }

    public async getLocationName(id: string): Promise<string> {
        return (await this.resolveLocation(id)).location.name;
    }

    private async getUsbStickNames(): Promise<string[]> {
        let entries;
        try {
            entries = await fs.readdir(this.getUsbPath(), {withFileTypes: true});
        } catch (e) {
            // the directory is gone when the last USB stick was removed
            return [];
        }
        return entries
            .filter(entry => entry.isDirectory() && StorageApiHelper.isValidName(entry.name))
            // the box's games take this place below the media URL
            .filter(entry => entry.name !== StorageApiHelper.BOX_MEDIA_FOLDER)
            .map(entry => entry.name)
            .sort((a, b) => a.localeCompare(b));
    }

    private async resolveLocation(id: string): Promise<IResolvedLocation> {
        if (id === StorageApiHelper.BOX_LOCATION_ID) {
            const gamesRoot = this.getBoxGamesPath();
            let writable = true;
            try {
                await fs.mkdir(gamesRoot, {recursive: true});
            } catch (e) {
                LoggerService.warn(`Can't create the storage of the box in ${gamesRoot}`, e);
                writable = false;
            }
            return {
                location: {
                    id,
                    type: 'box',
                    name: 'BuzzerBox',
                    writable: writable && await this.isWritable(gamesRoot),
                    gamesPath: '/' + StorageApiHelper.BOX_MEDIA_FOLDER,
                    ...await this.getSpace(gamesRoot)
                },
                gamesRoot
            };
        }
        if (id?.startsWith(StorageApiHelper.USB_LOCATION_ID_PREFIX)) {
            const name = id.substring(StorageApiHelper.USB_LOCATION_ID_PREFIX.length);
            if ((await this.getUsbStickNames()).includes(name)) {
                const stickRoot = path.join(this.getUsbPath(), name);
                return {
                    location: {
                        id,
                        type: 'usb',
                        name,
                        writable: await this.isWritable(stickRoot),
                        gamesPath: '/' + name + '/' + StorageApiHelper.GAMES_FOLDER_ON_USB,
                        mediaPath: '/' + name,
                        ...await this.getSpace(stickRoot)
                    },
                    gamesRoot: path.join(stickRoot, StorageApiHelper.GAMES_FOLDER_ON_USB),
                    stickRoot
                };
            }
        }
        throw new StorageError(404, `Unknown storage location ${id}`);
    }

    private async isWritable(directory: string): Promise<boolean> {
        try {
            await fs.access(directory, fsConstants.W_OK);
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * The free and total space of the file system, from df since the box's Node.js has no fs.statfs
     */
    private getSpace(directory: string): Promise<{freeBytes?: number, totalBytes?: number}> {
        return new Promise(resolve => {
            execFile('df', ['-Pk', directory], {timeout: 2000}, (error, stdout) => {
                const columns = error ? [] : (stdout.trim().split('\n')[1] ?? '').split(/\s+/);
                const totalBytes = Number(columns[1]) * 1024;
                const freeBytes = Number(columns[3]) * 1024;
                resolve(Number.isFinite(totalBytes) && Number.isFinite(freeBytes) ? {freeBytes, totalBytes} : {});
            });
        });
    }

    private async getWritableLocation(id: string): Promise<IResolvedLocation> {
        const resolved = await this.resolveLocation(id);
        if (!resolved.location.writable) {
            throw new StorageError(403, `${resolved.location.name} is read-only`);
        }
        return resolved;
    }

    // ---- games ----

    private getGameDirectories(resolved: IResolvedLocation, gameName: string): IGameDirectories {
        if (!StorageApiHelper.isValidName(gameName)) {
            throw new StorageError(400, `Invalid name ${gameName}`);
        }
        const root = path.join(resolved.gamesRoot, gameName);
        return {
            root,
            versions: path.join(root, 'versions'),
            states: path.join(root, 'states'),
            media: path.join(root, StorageApiHelper.GAME_MEDIA_FOLDER)
        };
    }

    private async getExistingGame(locationId: string, gameName: string, writable = false): Promise<{resolved: IResolvedLocation, dirs: IGameDirectories}> {
        const resolved = writable ? await this.getWritableLocation(locationId) : await this.resolveLocation(locationId);
        const dirs = this.getGameDirectories(resolved, gameName);
        if (!await this.isDirectory(dirs.root)) {
            throw new StorageError(404, `There is no game ${gameName}`);
        }
        return {resolved, dirs};
    }

    private isActive(locationId: string, gameName: string): boolean {
        return this.activeGame != null && this.activeGame.locationId === locationId && this.activeGame.gameName === gameName;
    }

    private checkNotActive(locationId: string, gameName: string, stateName?: string): void {
        if (this.isActive(locationId, gameName) && (stateName == null || this.activeGame.stateName === stateName)) {
            throw new StorageError(409, `${stateName ?? gameName} is being played right now`);
        }
    }

    public async listGames(locationId: string): Promise<IGameInfo[]> {
        const resolved = await this.resolveLocation(locationId);
        let entries;
        try {
            entries = await fs.readdir(resolved.gamesRoot, {withFileTypes: true});
        } catch (e) {
            // a USB stick without games
            return [];
        }
        const games: IGameInfo[] = [];
        for (const entry of entries) {
            if (entry.isDirectory() && StorageApiHelper.isValidName(entry.name)) {
                games.push(await this.getGameInfo(resolved, entry.name));
            }
        }
        return games.sort((a, b) => a.name.localeCompare(b.name, undefined, {numeric: true, sensitivity: 'base'}));
    }

    private async getGameInfo(resolved: IResolvedLocation, gameName: string): Promise<IGameInfo> {
        const dirs = this.getGameDirectories(resolved, gameName);
        const definitions = new Map<number, IGameDefinition>();
        for (const version of await this.listVersionNumbers(dirs.versions)) {
            const definition = await this.readDefinitionOrNull(dirs, version);
            if (definition != null) {
                definitions.set(version, definition);
            }
        }
        const states: IGameStateInfo[] = [];
        for (const name of await this.listJsonNames(dirs.states)) {
            const state = await this.readJsonOrNull<IGameInstanceState>(path.join(dirs.states, name + StorageApiHelper.JSON_EXTENSION));
            if (state != null) {
                const definition = definitions.get(state.gameVersion);
                states.push({
                    name,
                    gameVersion: state.gameVersion,
                    createdAt: state.createdAt,
                    updatedAt: state.updatedAt,
                    finished: !!state.finished,
                    progress: definition == null ? null : GameFormatHelper.getProgress(definition.rounds,
                        state.gameState == null ? null : GameFormatHelper.migrateGameState(state.gameState, definition.rounds)),
                    teams: (state.teams ?? []).map(team => ({name: team.name, points: team.points ?? 0}))
                });
            }
        }
        const versions: IGameVersionInfo[] = [];
        // walked only once a version shows media, which keeps listing many games on a slow stick quick
        let existingMedia: Set<string> | undefined;
        for (const [version, definition] of definitions) {
            versions.push({
                version,
                savedAt: definition.savedAt,
                questionCount: GameFormatHelper.getAllQuestions(definition.rounds).length,
                roundCount: definition.rounds.length,
                missingMediaCount: await this.countMissingMedia(definition, dirs, () => existingMedia, paths => existingMedia = paths),
                stateCount: states.filter(state => state.gameVersion === version).length
            });
        }
        versions.sort((a, b) => b.version - a.version);
        states.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
        return {
            name: gameName,
            latestVersion: versions[0]?.version ?? null,
            versions,
            states,
            inUse: this.isActive(resolved.location.id, gameName)
        };
    }

    public async createGame(locationId: string, gameName: string): Promise<IGameInfo> {
        const resolved = await this.getWritableLocation(locationId);
        const dirs = this.getGameDirectories(resolved, gameName);
        if (await this.exists(dirs.root)) {
            throw new StorageError(409, `There already is a game ${gameName}`);
        }
        try {
            for (const directory of [dirs.versions, dirs.states, dirs.media]) {
                await fs.mkdir(directory, {recursive: true});
            }
        } catch (e) {
            throw this.toWriteError(e);
        }
        LoggerService.log(`Created game ${gameName} on ${resolved.location.name}`);
        return this.getGameInfo(resolved, gameName);
    }

    /**
     * Deletes a game with all its versions, states and media; they are all part of it
     */
    public async deleteGame(locationId: string, gameName: string): Promise<void> {
        const {resolved, dirs} = await this.getExistingGame(locationId, gameName, true);
        this.checkNotActive(locationId, gameName);
        await this.removeRecursively(dirs.root);
        LoggerService.log(`Deleted game ${gameName} on ${resolved.location.name}`);
    }

    /**
     * Copies a game with its versions, states and media to another location, e.g. from a USB stick onto the box, and
     * with move deletes the original afterwards. The copy is assembled in a hidden folder and only appears under its
     * name once it is complete, so a stick pulled out meanwhile leaves no half game behind. Within the same location
     * it needs another name: moving there renames the game, copying makes a duplicate.
     */
    public async copyGame(locationId: string, gameName: string, body: {toLocation?: unknown, name?: unknown, move?: unknown}): Promise<IGameCopyResult> {
        const {toLocation, name = gameName, move = false} = body ?? {};
        if (typeof toLocation !== 'string' || typeof name !== 'string' || typeof move !== 'boolean') {
            throw new StorageError(400, 'Where to copy the game to is missing');
        }
        const {resolved: source, dirs: sourceDirs} = await this.getExistingGame(locationId, gameName, move);
        // the state of a game being played changes all the time, so the copy could miss the last points
        this.checkNotActive(locationId, gameName);
        const target = await this.getWritableLocation(toLocation);
        const isSameLocation = target.location.id === source.location.id;
        if (isSameLocation && name === gameName) {
            throw new StorageError(400, `${gameName} is already on ${target.location.name}`);
        }
        const targetDirs = this.getGameDirectories(target, name);
        if (await this.exists(targetDirs.root)) {
            throw new StorageError(409, `There already is a game ${name} on ${target.location.name}`);
        }
        if (isSameLocation && move) {
            try {
                await fs.rename(sourceDirs.root, targetDirs.root);
            } catch (e) {
                throw this.toWriteError(e);
            }
            LoggerService.log(`Renamed game ${gameName} on ${source.location.name} to ${name}`);
            return {...await this.getGameInfo(target, name), originalKept: false};
        }
        if (target.location.freeBytes != null && await this.getDirectorySize(sourceDirs.root) > target.location.freeBytes) {
            throw new StorageError(507, 'Not enough space left');
        }
        const temporaryDirectory = this.getTemporaryFile(targetDirs.root);
        try {
            await fs.mkdir(target.gamesRoot, {recursive: true});
            await this.copyGameDirectory(sourceDirs.root, temporaryDirectory);
            await fs.rename(temporaryDirectory, targetDirs.root);
        } catch (e) {
            await this.removeRecursively(temporaryDirectory).catch(() => undefined);
            throw this.toWriteError(e);
        }
        let originalKept = false;
        if (move) {
            try {
                await this.removeRecursively(sourceDirs.root);
            } catch (e) {
                // the copy is complete, so it isn't undone, e.g. when the stick was pulled out right after it
                LoggerService.warn(`Copied ${gameName}, but could not remove the original on ${source.location.name}`, e);
                originalKept = true;
            }
        }
        LoggerService.log(`${move && !originalKept ? 'Moved' : 'Copied'} game ${gameName} from ${source.location.name} to ${target.location.name} as ${name}`);
        return {...await this.getGameInfo(target, name), originalKept};
    }

    /**
     * Everything of a game: its versions and states (JSON) and its media, but no hidden files like unfinished copies
     */
    private async copyGameDirectory(source: string, target: string): Promise<void> {
        await fs.mkdir(target, {recursive: true});
        for (const entry of await fs.readdir(source, {withFileTypes: true})) {
            if (!StorageApiHelper.isValidName(entry.name)) {
                continue;
            }
            if (entry.isDirectory()) {
                await this.copyGameDirectory(path.join(source, entry.name), path.join(target, entry.name));
            } else if (entry.isFile()) {
                await this.copyFileSynced(path.join(source, entry.name), path.join(target, entry.name));
            }
        }
    }

    private async getDirectorySize(directory: string): Promise<number> {
        let size = 0;
        for (const entry of await fs.readdir(directory, {withFileTypes: true})) {
            const entryPath = path.join(directory, entry.name);
            if (entry.isDirectory()) {
                size += await this.getDirectorySize(entryPath);
            } else if (entry.isFile()) {
                size += (await fs.stat(entryPath)).size;
            }
        }
        return size;
    }

    // ---- archives ----

    /**
     * The whole game as a tar.gz archive, to bring it to another box through a device: its versions, states and media,
     * laid out as in the game's folder. Media hardly compress, so the box's slow CPU only compresses lightly.
     */
    public async createGameArchive(locationId: string, gameName: string): Promise<Readable> {
        const {dirs} = await this.getExistingGame(locationId, gameName);
        const folders: string[] = [];
        for (const folder of StorageService.ARCHIVE_FOLDERS) {
            if (await this.isDirectory(path.join(dirs.root, folder))) {
                folders.push(folder);
            }
        }
        LoggerService.log(`Creating an archive of ${gameName}`);
        return Readable.from(tar.create({
            cwd: dirs.root,
            gzip: {level: 1},
            portable: true,
            // no unfinished uploads or other hidden files
            filter: entryPath => entryPath.split('/').every(segment => segment === '.' || StorageApiHelper.isValidName(segment))
        }, folders));
    }

    /**
     * Creates a game from an archive of createGameArchive. Only what belongs in a game is taken from it: version and
     * state files and media files, no links and nothing outside the game's folder. The game only appears under its name
     * once it is complete and its versions and states could be read.
     */
    public async importGameArchive(locationId: string, gameName: string, content: Readable, contentLength: number | undefined): Promise<IGameImportResult> {
        const resolved = await this.getWritableLocation(locationId);
        const dirs = this.getGameDirectories(resolved, gameName);
        if (await this.exists(dirs.root)) {
            throw new StorageError(409, `There already is a game ${gameName}`);
        }
        const freeBytes = resolved.location.freeBytes;
        if (contentLength != null && freeBytes != null && contentLength > freeBytes) {
            throw new StorageError(507, `Not enough space on ${resolved.location.name}`);
        }
        const skipped: string[] = [];
        let extractedBytes = 0;
        let isTooLarge = false;
        const temporaryDirectory = this.getTemporaryFile(dirs.root);
        let unpack: tar.Unpack | undefined;
        try {
            await fs.mkdir(temporaryDirectory, {recursive: true});
            unpack = new tar.Unpack({
                cwd: temporaryDirectory,
                strict: true,
                // the files belong to the server's user with its permissions, whoever packed them
                preserveOwner: false,
                filter: (entryPath, entry) => {
                    const normalized = this.normalizeRelativePath(entryPath.replace(/^\.\//, ''));
                    const type = 'type' in entry ? entry.type : undefined;
                    if (!this.isArchiveEntryOfGame(normalized, type)) {
                        // hidden files like the ._ files of macOS aren't worth mentioning
                        if (normalized !== '' && !path.posix.basename(normalized).startsWith('.')) {
                            skipped.push(normalized);
                        }
                        return false;
                    }
                    extractedBytes += entry.size ?? 0;
                    if (freeBytes != null && extractedBytes > freeBytes) {
                        isTooLarge = true;
                        return false;
                    }
                    return true;
                }
            });
            await pipelineAsync(content, unpack);
            // it has closed, nothing is written anymore
            unpack = undefined;
            if (isTooLarge) {
                throw new StorageError(507, `Not enough space on ${resolved.location.name}`);
            }
            const temporaryDirs = {...dirs, root: temporaryDirectory, versions: path.join(temporaryDirectory, 'versions'),
                states: path.join(temporaryDirectory, 'states'), media: path.join(temporaryDirectory, StorageApiHelper.GAME_MEDIA_FOLDER)};
            await this.checkArchivedGame(temporaryDirs);
            // the stick may be pulled out right after the upload
            await this.syncDirectory(temporaryDirectory);
            await fs.rename(temporaryDirectory, dirs.root);
        } catch (e) {
            await this.removeUnpacked(unpack, temporaryDirectory);
            if (e instanceof StorageError) {
                throw e;
            }
            if (e?.code?.startsWith?.('TAR_') || e?.code === 'Z_DATA_ERROR' || e?.code === 'Z_BUF_ERROR') {
                throw new StorageError(400, 'This is not an archive of a game');
            }
            throw this.toWriteError(e);
        }
        LoggerService.log(`Imported the archive of ${gameName} on ${resolved.location.name}, skipped: ${skipped.length}`);
        return {gameName, missingMedia: [], skippedEntries: skipped};
    }

    /**
     * Removes what was extracted of a broken archive. When the archive breaks off, the extraction may still be writing
     * the last files, which would recreate folders being deleted, so this waits for it to end and tries again; unpack is
     * only given then.
     */
    private async removeUnpacked(unpack: tar.Unpack | undefined, directory: string): Promise<void> {
        if (unpack != null) {
            await new Promise<void>(resolve => {
                const timeout = setTimeout(resolve, 5000);
                unpack.once('close', () => { clearTimeout(timeout); resolve(); });
            });
        }
        for (let attempt = 1; attempt <= 5; attempt++) {
            try {
                await this.removeRecursively(directory);
                if (!await this.exists(directory)) {
                    return;
                }
            } catch (e) {
                // still being written to
            }
            await new Promise(resolve => setTimeout(resolve, 200 * attempt));
        }
        LoggerService.warn(`Could not remove ${directory}`);
    }

    /**
     * Whether an entry of an archive is part of a game: a version, a state, or media or folders below media
     */
    private isArchiveEntryOfGame(entryPath: string, type: string | undefined): boolean {
        const segments = entryPath.split('/');
        if (!segments.every(segment => StorageApiHelper.isValidName(segment))) {
            return false;
        }
        const [folder, ...rest] = segments;
        if (type === 'Directory') {
            return StorageService.ARCHIVE_FOLDERS.includes(folder) && (rest.length === 0 || folder === StorageApiHelper.GAME_MEDIA_FOLDER);
        }
        if (type !== 'File' && type !== 'OldFile' && type !== 'ContiguousFile') {
            return false;
        }
        if (folder === 'versions') {
            return rest.length === 1 && (/^[1-9][0-9]*\.json$/.test(rest[0]) || rest[0] === StorageService.NUMBERING_FILE);
        }
        if (folder === 'states') {
            return rest.length === 1 && rest[0].endsWith(StorageApiHelper.JSON_EXTENSION);
        }
        return folder === StorageApiHelper.GAME_MEDIA_FOLDER && rest.length > 0
            && FileExtensionsService.isSupportedExtension(path.extname(rest[rest.length - 1]));
    }

    /**
     * Reads the versions and states of an extracted archive, so a broken one doesn't become a game
     */
    private async checkArchivedGame(dirs: IGameDirectories): Promise<void> {
        for (const directory of [dirs.versions, dirs.states, dirs.media]) {
            await fs.mkdir(directory, {recursive: true});
        }
        const versions = await this.listVersionNumbers(dirs.versions);
        if (versions.length === 0) {
            throw new StorageError(400, 'The archive has no version of a game');
        }
        for (const version of versions) {
            const definition = await this.readDefinitionOrNull(dirs, version);
            if (definition == null || definition.version !== version) {
                throw new StorageError(400, `Version ${version} in the archive is broken`);
            }
        }
        for (const name of await this.listJsonNames(dirs.states)) {
            const state = await this.readJsonOrNull<IGameInstanceState>(path.join(dirs.states, name + StorageApiHelper.JSON_EXTENSION));
            if (state?.kind !== 'state' || !versions.includes(state.gameVersion)) {
                throw new StorageError(400, `The state ${name} in the archive is broken`);
            }
        }
    }

    private async syncDirectory(directory: string): Promise<void> {
        for (const entry of await fs.readdir(directory, {withFileTypes: true})) {
            if (entry.isDirectory()) {
                await this.syncDirectory(path.join(directory, entry.name));
            } else if (entry.isFile()) {
                await this.syncFile(path.join(directory, entry.name));
            }
        }
    }

    // ---- versions ----

    private getVersionFile(dirs: IGameDirectories, version: number): string {
        return path.join(dirs.versions, version + StorageApiHelper.JSON_EXTENSION);
    }

    private async listVersionNumbers(versionsDirectory: string): Promise<number[]> {
        return (await this.listJsonNames(versionsDirectory))
            .filter(name => /^[1-9][0-9]*$/.test(name))
            .map(name => Number(name))
            .sort((a, b) => a - b);
    }

    private async getLatestVersionNumber(dirs: IGameDirectories): Promise<number | null> {
        const versions = await this.listVersionNumbers(dirs.versions);
        return versions.length > 0 ? versions[versions.length - 1] : null;
    }

    /**
     * Remembers the highest version number a game ever had, so a deleted version's number isn't given to other
     * questions later, e.g. while a downloaded copy of it is still around. It travels with the game in its versions.
     */
    private getNumberingFile(dirs: IGameDirectories): string {
        return path.join(dirs.versions, StorageService.NUMBERING_FILE);
    }

    private async getHighestVersionNumber(dirs: IGameDirectories): Promise<number> {
        const numbering = await this.readJsonOrNull<{highestVersion?: unknown}>(this.getNumberingFile(dirs));
        const recorded = Number.isInteger(numbering?.highestVersion) ? numbering.highestVersion as number : 0;
        return Math.max(recorded, await this.getLatestVersionNumber(dirs) ?? 0);
    }

    public async getVersion(locationId: string, gameName: string, version: string): Promise<IGameDefinition> {
        const {dirs} = await this.getExistingGame(locationId, gameName);
        const number = version === StorageService.LATEST ? await this.getLatestVersionNumber(dirs) : Number(version);
        if (number == null || !Number.isInteger(number)) {
            throw new StorageError(404, `${gameName} has no version ${version}`);
        }
        return this.readDefinition(dirs, number, `${gameName} has no version ${version}`);
    }

    /**
     * A version in the current format, see GameFormatHelper; the file itself stays as it is
     */
    private async readDefinition(dirs: IGameDirectories, version: number, notFoundMessage: string): Promise<IGameDefinition> {
        const definition = GameFormatHelper.migrateDefinition(await this.readJson<unknown>(this.getVersionFile(dirs, version), notFoundMessage));
        if (definition == null) {
            throw new StorageError(500, `Version ${version} is broken or made by a newer version of the BuzzerBox`);
        }
        return definition;
    }

    private async readDefinitionOrNull(dirs: IGameDirectories, version: number): Promise<IGameDefinition | null> {
        const json = await this.readJsonOrNull<unknown>(this.getVersionFile(dirs, version));
        const definition = json == null ? null : GameFormatHelper.migrateDefinition(json);
        if (json != null && definition == null) {
            LoggerService.warn(`Ignoring version ${version} in ${dirs.versions}, which is broken or made by a newer version`);
        }
        return definition;
    }

    /**
     * Stores the rounds as a new version of the game, which is created if it doesn't exist yet. If they are the same
     * as in the latest version, no version is added.
     */
    public async saveVersion(locationId: string, gameName: string, body: {rounds?: unknown, mediaDefaults?: unknown}): Promise<IGameVersionInfo & {unchanged: boolean}> {
        const rounds: IRound[] | null = GameFormatHelper.checkRounds(body?.rounds);
        if (rounds == null) {
            throw new StorageError(400, 'A game version needs its rounds, in modes this version can play');
        }
        if (body.mediaDefaults != null && (typeof body.mediaDefaults !== 'object' || Array.isArray(body.mediaDefaults))) {
            throw new StorageError(400, 'The media defaults of a game version must be an object');
        }
        const mediaDefaults = body.mediaDefaults as Partial<IMediaQuestionDefaults> | undefined;
        const resolved = await this.getWritableLocation(locationId);
        const dirs = this.getGameDirectories(resolved, gameName);
        await fs.mkdir(dirs.versions, {recursive: true}).catch(e => { throw this.toWriteError(e); });
        await fs.mkdir(dirs.states, {recursive: true});
        await fs.mkdir(dirs.media, {recursive: true});
        const latest = await this.getLatestVersionNumber(dirs);
        if (latest != null) {
            const latestDefinition = await this.readDefinitionOrNull(dirs, latest);
            if (latestDefinition != null && isEqual(latestDefinition.rounds, rounds)
                && isEqual(latestDefinition.mediaDefaults, mediaDefaults)) {
                return {...await this.getVersionInfo(resolved, gameName, latest), unchanged: true};
            }
        }
        const version = await this.getHighestVersionNumber(dirs) + 1;
        const definition: IGameDefinition = {
            formatVersion: CURRENT_GAME_FORMAT_VERSION,
            kind: 'game',
            version,
            savedAt: ClockService.get().nowAsIsoString(),
            rounds
        };
        if (mediaDefaults != null) {
            definition.mediaDefaults = mediaDefaults;
        }
        await this.writeJsonAtomically(this.getVersionFile(dirs, version), definition, false);
        LoggerService.log(`Saved version ${version} of ${gameName} on ${resolved.location.name}`);
        return {...await this.getVersionInfo(resolved, gameName, version), unchanged: false};
    }

    private async countMissingMedia(definition: IGameDefinition, dirs: IGameDirectories, getPaths: () => Set<string> | undefined,
                                    setPaths: (paths: Set<string>) => void): Promise<number> {
        const showsMedia = GameFormatHelper.getAllQuestions(definition.rounds).some(question => question.mediaDetails?.fileSrc || question.mediaDetails?.slides?.length);
        if (!showsMedia) {
            return 0;
        }
        if (getPaths() == null) {
            setPaths(await this.listMediaPaths(dirs.media));
        }
        return MediaHelper.findMissingMedia(definition.rounds, getPaths()).length;
    }

    /**
     * The media in a game's media folder as paths relative to it, to tell which media of its questions are missing:
     * the files the file server serves, and the folders with such files in them, like the media tree (buildTree) has
     * them, which the master checks before a game starts
     */
    private async listMediaPaths(directory: string, relativePath = '', paths = new Set<string>()): Promise<Set<string>> {
        let entries;
        try {
            entries = await fs.readdir(directory, {withFileTypes: true});
        } catch (e) {
            return paths;
        }
        for (const entry of entries) {
            if (!StorageApiHelper.isValidName(entry.name)) {
                continue;
            }
            const entryPath = StorageApiHelper.joinPath(relativePath, entry.name);
            if (entry.isDirectory()) {
                const countBefore = paths.size;
                await this.listMediaPaths(path.join(directory, entry.name), entryPath, paths);
                if (paths.size > countBefore) {
                    paths.add(entryPath);
                }
            } else if (entry.isFile() && FileExtensionsService.isSupportedExtension(path.extname(entry.name))) {
                paths.add(entryPath);
            }
        }
        return paths;
    }

    private async getVersionInfo(resolved: IResolvedLocation, gameName: string, version: number): Promise<IGameVersionInfo> {
        return (await this.getGameInfo(resolved, gameName)).versions.find(info => info.version === version);
    }

    /**
     * Only versions no state plays can be deleted. Their numbers aren't used again, see getNumberingFile.
     */
    public async deleteVersion(locationId: string, gameName: string, version: string): Promise<void> {
        const {resolved, dirs} = await this.getExistingGame(locationId, gameName, true);
        const info = await this.getGameInfo(resolved, gameName);
        const versionInfo = info.versions.find(v => String(v.version) === version);
        if (versionInfo == null) {
            throw new StorageError(404, `${gameName} has no version ${version}`);
        }
        if (versionInfo.stateCount > 0 || (this.isActive(locationId, gameName) && this.activeGame.gameVersion === versionInfo.version)) {
            throw new StorageError(409, `Version ${version} is played in ${versionInfo.stateCount} state(s)`);
        }
        const highestVersion = await this.getHighestVersionNumber(dirs);
        await this.writeJsonAtomically(this.getNumberingFile(dirs), {highestVersion}, true);
        await fs.unlink(this.getVersionFile(dirs, versionInfo.version));
    }

    // ---- states ----

    private getStateFile(dirs: IGameDirectories, stateName: string): string {
        if (!StorageApiHelper.isValidName(stateName)) {
            throw new StorageError(400, `Invalid name ${stateName}`);
        }
        return path.join(dirs.states, stateName + StorageApiHelper.JSON_EXTENSION);
    }

    /**
     * The state in the current format, for the version it plays, see GameFormatHelper; the file itself stays as it is
     */
    public async getState(locationId: string, gameName: string, stateName: string): Promise<IGameInstanceState> {
        const {dirs} = await this.getExistingGame(locationId, gameName);
        const state = await this.readJson<IGameInstanceState>(this.getStateFile(dirs, stateName), `There is no state ${stateName}`);
        const definition = await this.readDefinitionOrNull(dirs, state.gameVersion);
        return definition == null ? state : GameFormatHelper.migrateState(state, definition);
    }

    public async getStateOrNull(ref: IGameStorageRef): Promise<IGameInstanceState | null> {
        try {
            return await this.getState(ref.locationId, ref.gameName, ref.stateName);
        } catch (e) {
            return null;
        }
    }

    /**
     * Stores the state of the running game, see AutosaveService
     */
    public async writeState(ref: IGameStorageRef, state: IGameInstanceState): Promise<void> {
        const {dirs} = await this.getExistingGame(ref.locationId, ref.gameName, true);
        await fs.mkdir(dirs.states, {recursive: true}).catch(e => { throw this.toWriteError(e); });
        await this.writeJsonAtomically(this.getStateFile(dirs, ref.stateName), state, true);
    }

    /**
     * The name, or the name with a number if there already is a state with it
     */
    public async makeUniqueStateName(locationId: string, gameName: string, name: string): Promise<string> {
        const base = StorageApiHelper.sanitizeName(name) || 'Spiel';
        const {dirs} = await this.getExistingGame(locationId, gameName);
        return this.makeUniqueName(dirs.states, base, StorageApiHelper.JSON_EXTENSION);
    }

    public async renameState(locationId: string, gameName: string, stateName: string, newName: unknown): Promise<void> {
        if (typeof newName !== 'string') {
            throw new StorageError(400, 'The new name is missing');
        }
        const {resolved, dirs} = await this.getExistingGame(locationId, gameName, true);
        this.checkNotActive(locationId, gameName, stateName);
        const source = this.getStateFile(dirs, stateName);
        const target = this.getStateFile(dirs, newName);
        if (!await this.isFile(source)) {
            throw new StorageError(404, `There is no state ${stateName}`);
        }
        if (await this.exists(target)) {
            throw new StorageError(409, `There already is a state ${newName}`);
        }
        try {
            await fs.rename(source, target);
        } catch (e) {
            throw this.toWriteError(e);
        }
        LoggerService.log(`Renamed state ${stateName} of ${gameName} on ${resolved.location.name} to ${newName}`);
    }

    public async deleteState(locationId: string, gameName: string, stateName: string): Promise<void> {
        const {dirs} = await this.getExistingGame(locationId, gameName, true);
        this.checkNotActive(locationId, gameName, stateName);
        try {
            await fs.unlink(this.getStateFile(dirs, stateName));
        } catch (e) {
            throw new StorageError(404, `There is no state ${stateName}`);
        }
    }

    // ---- media of a game ----

    private async getGameMediaRoot(locationId: string, gameName: string, writable = false): Promise<{resolved: IResolvedLocation, dirs: IGameDirectories}> {
        const game = await this.getExistingGame(locationId, gameName, writable);
        await fs.mkdir(game.dirs.media, {recursive: true}).catch(() => undefined);
        return game;
    }

    public async getGameMediaTree(locationId: string, gameName: string): Promise<IDirectoryTree> {
        const {dirs} = await this.getGameMediaRoot(locationId, gameName);
        return (await this.buildTree(dirs.media, '', StorageApiHelper.GAME_MEDIA_FOLDER, true));
    }

    public async listGameMedia(locationId: string, gameName: string, relativePath: string): Promise<IStorageFolder> {
        const {dirs} = await this.getGameMediaRoot(locationId, gameName);
        const folder = await this.listFolder(dirs.media, relativePath);
        const usage = await this.readMediaUsage(dirs);
        for (const entry of folder.entries) {
            const usedBy = this.getVersionsShowing(usage, StorageApiHelper.joinPath(folder.path, entry.name));
            if (usedBy.length > 0) {
                entry.usedByVersions = usedBy;
            }
        }
        return folder;
    }

    public async uploadGameMedia(locationId: string, gameName: string, relativePath: string, content: Readable, overwrite: boolean,
                                 contentLength: number | undefined): Promise<IStorageEntry> {
        const {resolved, dirs} = await this.getGameMediaRoot(locationId, gameName, true);
        const freeBytes = resolved.location.freeBytes;
        if (contentLength != null && freeBytes != null && contentLength > freeBytes) {
            throw new StorageError(507, `Not enough space on ${resolved.location.name}`);
        }
        const entry = await this.storeFile(dirs.media, relativePath, content, overwrite);
        LoggerService.log(`Stored ${relativePath} in ${gameName} on ${resolved.location.name}`);
        return entry;
    }

    public async createGameMediaFolder(locationId: string, gameName: string, relativePath: string): Promise<IStorageEntry> {
        const {dirs} = await this.getGameMediaRoot(locationId, gameName, true);
        const directory = this.resolvePath(dirs.media, relativePath);
        if (directory === dirs.media) {
            throw new StorageError(400, 'No folder name given');
        }
        if (await this.exists(directory)) {
            throw new StorageError(409, `There already is a ${path.basename(directory)}`);
        }
        try {
            await fs.mkdir(directory, {recursive: true});
        } catch (e) {
            throw this.toWriteError(e);
        }
        const stats = await fs.stat(directory);
        return {name: path.basename(directory), type: 'directory', modified: stats.mtime.toISOString()};
    }

    /**
     * Deletes a media file or folder of a game, unless one of the game's versions shows it
     */
    /**
     * The media paths each version shows, to tell which media can't be changed: versions never change, so their media
     * have to stay where they are
     */
    private async readMediaUsage(dirs: IGameDirectories): Promise<{version: number, paths: string[]}[]> {
        const usage: {version: number, paths: string[]}[] = [];
        for (const version of await this.listVersionNumbers(dirs.versions)) {
            const definition = await this.readDefinitionOrNull(dirs, version);
            const paths: string[] = [];
            for (const question of GameFormatHelper.getAllQuestions(definition?.rounds)) {
                paths.push(question.mediaDetails?.fileSrc, ...(question.mediaDetails?.slides ?? []));
            }
            usage.push({version, paths: paths.filter(p => !!p).map(p => this.normalizeRelativePath(p))});
        }
        return usage;
    }

    /**
     * The versions that show the file, or media in the folder
     */
    private getVersionsShowing(usage: {version: number, paths: string[]}[], relativePath: string): number[] {
        const normalized = this.normalizeRelativePath(relativePath);
        return usage.filter(entry => entry.paths.some(p => p === normalized || p.startsWith(normalized + '/'))).map(entry => entry.version);
    }

    private async checkNotShown(dirs: IGameDirectories, relativePath: string): Promise<void> {
        const usedBy = this.getVersionsShowing(await this.readMediaUsage(dirs), relativePath);
        if (usedBy.length > 0) {
            throw new StorageError(409, `Version ${usedBy.join(', ')} of the game shows ${path.posix.basename(relativePath)}`);
        }
    }

    public async deleteGameMedia(locationId: string, gameName: string, relativePath: string): Promise<void> {
        const {resolved, dirs} = await this.getGameMediaRoot(locationId, gameName, true);
        const target = this.resolvePath(dirs.media, relativePath);
        if (target === dirs.media) {
            throw new StorageError(400, 'The media folder itself can\'t be deleted');
        }
        await this.checkNotShown(dirs, relativePath);
        let stats;
        try {
            stats = await fs.stat(target);
        } catch (e) {
            throw new StorageError(404, `There is no ${relativePath}`);
        }
        if (stats.isDirectory()) {
            // everything in a game's media folder belongs to the game
            await this.removeRecursively(target);
        } else {
            await fs.unlink(target);
        }
        LoggerService.log(`Deleted ${relativePath} in ${gameName} on ${resolved.location.name}`);
    }

    /**
     * Renames or moves a file or folder within the game's media; toPath is its new path, folder and name. Media that a
     * version shows stay where they are.
     */
    public async moveGameMedia(locationId: string, gameName: string, relativePath: string, toPath: unknown): Promise<IStorageEntry> {
        if (typeof toPath !== 'string') {
            throw new StorageError(400, 'Where to move it to is missing');
        }
        const {resolved, dirs} = await this.getGameMediaRoot(locationId, gameName, true);
        const source = this.resolvePath(dirs.media, relativePath);
        const target = this.resolvePath(dirs.media, toPath);
        if (source === dirs.media || target === dirs.media) {
            throw new StorageError(400, 'The media folder itself can\'t be moved');
        }
        let stats;
        try {
            stats = await fs.stat(source);
        } catch (e) {
            throw new StorageError(404, `There is no ${relativePath}`);
        }
        if (stats.isDirectory() ? this.isInside(target, source) : !FileExtensionsService.isSupportedExtension(path.extname(target))) {
            throw new StorageError(400, stats.isDirectory() ? 'A folder can\'t go into itself' : `${path.basename(target)} is no supported media file`);
        }
        if (await this.exists(target)) {
            throw new StorageError(409, `There already is ${path.basename(target)}`);
        }
        await this.checkNotShown(dirs, relativePath);
        try {
            await fs.mkdir(path.dirname(target), {recursive: true});
            await fs.rename(source, target);
        } catch (e) {
            throw this.toWriteError(e);
        }
        LoggerService.log(`Moved ${relativePath} in ${gameName} on ${resolved.location.name} to ${toPath}`);
        const targetStats = await fs.stat(target);
        return {
            name: path.basename(target),
            type: stats.isDirectory() ? 'directory' : 'file',
            size: stats.isDirectory() ? undefined : targetStats.size,
            modified: targetStats.mtime.toISOString()
        };
    }

    /**
     * Copies a media file, or a folder with the media in it, from a USB stick's other media into a folder of the game.
     * A file or folder with the same name gets a number.
     */
    public async copyIntoGame(locationId: string, gameName: string, targetFolder: string, fromLocationId: unknown,
                              fromPath: unknown): Promise<IStorageEntry> {
        if (typeof fromLocationId !== 'string' || typeof fromPath !== 'string') {
            throw new StorageError(400, 'Where to copy from is missing');
        }
        const source = await this.resolveLocation(fromLocationId);
        if (source.stickRoot == null) {
            throw new StorageError(400, 'Only media of USB sticks can be copied into a game');
        }
        const sourcePath = this.resolvePath(source.stickRoot, fromPath);
        if (sourcePath === source.stickRoot || this.isInside(sourcePath, source.gamesRoot)) {
            throw new StorageError(400, `${fromPath} can't be copied`);
        }
        const {dirs} = await this.getGameMediaRoot(locationId, gameName, true);
        const targetDirectory = this.resolvePath(dirs.media, targetFolder);
        let stats;
        try {
            stats = await fs.stat(sourcePath);
        } catch (e) {
            throw new StorageError(404, `There is no ${fromPath}`);
        }
        await fs.mkdir(targetDirectory, {recursive: true}).catch(e => { throw this.toWriteError(e); });
        const name = await this.copyMedia(sourcePath, stats.isDirectory(), targetDirectory);
        const targetStats = await fs.stat(path.join(targetDirectory, name));
        return {
            name,
            type: stats.isDirectory() ? 'directory' : 'file',
            size: stats.isDirectory() ? undefined : targetStats.size,
            modified: targetStats.mtime.toISOString()
        };
    }

    /**
     * @return the name of the copy in the target directory
     */
    private async copyMedia(source: string, isDirectory: boolean, targetDirectory: string): Promise<string> {
        const extension = isDirectory ? '' : path.extname(source);
        if (!isDirectory && !FileExtensionsService.isSupportedExtension(extension)) {
            throw new StorageError(400, `${path.basename(source)} is no supported media file`);
        }
        const name = await this.makeUniqueName(targetDirectory, path.basename(source, extension), extension) + extension;
        const target = path.join(targetDirectory, name);
        try {
            if (isDirectory) {
                await this.copyMediaDirectory(source, target);
            } else {
                await this.copyFileSynced(source, target);
            }
        } catch (e) {
            throw this.toWriteError(e);
        }
        return name;
    }

    private async copyMediaDirectory(source: string, target: string): Promise<void> {
        await fs.mkdir(target, {recursive: true});
        for (const entry of await fs.readdir(source, {withFileTypes: true})) {
            if (!StorageApiHelper.isValidName(entry.name)) {
                continue;
            }
            if (entry.isDirectory()) {
                await this.copyMediaDirectory(path.join(source, entry.name), path.join(target, entry.name));
            } else if (entry.isFile() && FileExtensionsService.isSupportedExtension(path.extname(entry.name))) {
                await this.copyFileSynced(path.join(source, entry.name), path.join(target, entry.name));
            }
        }
    }

    private async copyFileSynced(source: string, target: string): Promise<void> {
        const temporaryFile = this.getTemporaryFile(target);
        try {
            await fs.copyFile(source, temporaryFile);
            await this.syncFile(temporaryFile);
            await fs.rename(temporaryFile, target);
        } catch (e) {
            await fs.unlink(temporaryFile).catch(() => undefined);
            throw e;
        }
    }

    // ---- other media of USB sticks ----

    /**
     * The media of a USB stick that aren't in a game, to copy them into one
     */
    public async listStickMedia(locationId: string, relativePath: string): Promise<IStorageFolder> {
        const resolved = await this.resolveLocation(locationId);
        if (resolved.stickRoot == null) {
            throw new StorageError(400, 'Only USB sticks have other media');
        }
        return this.listFolder(resolved.stickRoot, relativePath, resolved.gamesRoot);
    }

    // ---- import ----

    /**
     * Creates a game from a bundle. Its media can be URLs of media on the box (as in old savegames) or relative paths
     * (as in bundles of games); the media that are found are copied into the game. The paths of the others are kept, so
     * uploading a file with the same name into the game makes them work.
     */
    public async importBundle(locationId: string, gameName: string, bundle: IGameBundle): Promise<IGameImportResult> {
        // bundles from before rounds existed have questions instead
        const game = bundle?.kind === 'bundle' ? GameFormatHelper.migrateDefinition(bundle.game) : null;
        if (game == null) {
            throw new StorageError(400, 'This is not a game, or one made by a newer version of the BuzzerBox');
        }
        const resolved = await this.getWritableLocation(locationId);
        const dirs = this.getGameDirectories(resolved, gameName);
        if (await this.exists(dirs.root)) {
            throw new StorageError(409, `There already is a game ${gameName}`);
        }
        await this.createGame(locationId, gameName);
        const missingMedia: string[] = [];
        const importedQuestions: IQuestion[] = [];
        // the same file may be shown by several questions, but is only copied once
        const copies = new Map<string, string>();
        for (const question of GameFormatHelper.getAllQuestions(game.rounds)) {
            importedQuestions.push(await this.importQuestionMedia(question, dirs.media, missingMedia, copies));
        }
        // the questions are in the same order as they were taken out of the rounds
        let questionIndex = 0;
        const rounds = GameFormatHelper.mapQuestions(game.rounds, () => importedQuestions[questionIndex++]);
        const now = ClockService.get().nowAsIsoString();
        const definition: IGameDefinition = {formatVersion: CURRENT_GAME_FORMAT_VERSION, kind: 'game', version: 1, savedAt: now, rounds};
        if (game.mediaDefaults != null) {
            definition.mediaDefaults = game.mediaDefaults;
        }
        await this.writeJsonAtomically(this.getVersionFile(dirs, 1), definition, false);
        const result: IGameImportResult = {gameName, missingMedia};
        if (bundle.state != null) {
            const stateName = await this.makeUniqueName(dirs.states, StorageApiHelper.sanitizeName(bundle.stateName ?? '') || 'Importiert', StorageApiHelper.JSON_EXTENSION);
            const state: IGameInstanceState = {
                formatVersion: CURRENT_GAME_FORMAT_VERSION,
                kind: 'state',
                gameVersion: 1,
                createdAt: bundle.state.createdAt ?? now,
                updatedAt: bundle.state.updatedAt ?? now,
                finished: !!bundle.state.finished,
                teams: bundle.state.teams ?? [],
                gameState: bundle.state.gameState == null ? bundle.state.gameState : GameFormatHelper.migrateGameState(bundle.state.gameState, rounds)
            };
            await this.writeJsonAtomically(this.getStateFile(dirs, stateName), state, false);
            result.stateName = stateName;
        }
        LoggerService.log(`Imported game ${gameName} on ${resolved.location.name}, missing media: ${missingMedia.length}`);
        return result;
    }

    private async importQuestionMedia(question: IQuestion, mediaDirectory: string, missingMedia: string[],
                                      copies: Map<string, string>): Promise<IQuestion> {
        const details = question.mediaDetails;
        if (!details?.fileSrc) {
            return question;
        }
        const relativeSource = this.toRelativeMediaPath(details.fileSrc);
        if (relativeSource != null) {
            // a bundle of a game: its media aren't in it
            const slides = details.slides?.map(slide => this.toRelativeMediaPath(slide) ?? this.urlBaseName(slide));
            for (const p of slides?.length ? slides : [relativeSource]) {
                if (!missingMedia.includes(p)) {
                    missingMedia.push(p);
                }
            }
            return {...question, mediaDetails: {...details, fileSrc: relativeSource, slides}};
        }
        if (details.slides?.length) {
            // a slideshow: its folder becomes a folder of the game, with the images of the slideshow in it
            const sourceFolder = await this.findMediaOfUrl(details.fileSrc);
            let folderName = copies.get(sourceFolder ?? details.fileSrc);
            if (folderName == null) {
                folderName = await this.makeUniqueName(mediaDirectory, this.urlBaseName(details.fileSrc), '');
                copies.set(sourceFolder ?? details.fileSrc, folderName);
            }
            const slides: string[] = [];
            for (const slide of details.slides) {
                const slideSource = await this.findMediaOfUrl(slide);
                const slidePath = StorageApiHelper.joinPath(folderName, this.urlBaseName(slide));
                const target = this.resolvePath(mediaDirectory, slidePath);
                if (slideSource != null && await this.isFile(slideSource)) {
                    if (!await this.exists(target)) {
                        await fs.mkdir(path.dirname(target), {recursive: true});
                        await this.copyFileSynced(slideSource, target).catch(e => { throw this.toWriteError(e); });
                    }
                } else {
                    missingMedia.push(slidePath);
                }
                slides.push(slidePath);
            }
            return {...question, mediaDetails: {...details, fileSrc: folderName, slides}};
        }
        const sourcePath = await this.findMediaOfUrl(details.fileSrc);
        if (sourcePath != null && await this.isFile(sourcePath)) {
            let name = copies.get(sourcePath);
            if (name == null) {
                name = await this.copyMedia(sourcePath, false, mediaDirectory);
                copies.set(sourcePath, name);
            }
            return {...question, mediaDetails: {...details, fileSrc: name}};
        }
        const name = this.urlBaseName(details.fileSrc);
        missingMedia.push(name);
        return {...question, mediaDetails: {...details, fileSrc: name}};
    }

    /**
     * The path if it is relative to a game's media, null if it is a URL
     */
    private toRelativeMediaPath(mediaPath: string): string | null {
        return !/^[a-z]+:\/\//i.test(mediaPath) && !mediaPath.startsWith('/') && StorageApiHelper.isValidRelativePath(mediaPath) ? mediaPath : null;
    }

    private urlBaseName(url: string): string {
        const segments = this.getUrlPath(url).split('/').filter(s => s !== '');
        return StorageApiHelper.sanitizeName(segments[segments.length - 1] ?? '') || 'medium';
    }

    private getUrlPath(url: string): string {
        try {
            return decodeURIComponent(new URL(url, 'http://localhost').pathname);
        } catch (e) {
            return '';
        }
    }

    /**
     * Where a media URL of the file server points to on this box, or null if it isn't there
     */
    private async findMediaOfUrl(url: string): Promise<string | null> {
        const publicPath = this.config.fileServer.publicPath + '/';
        const urlPath = this.getUrlPath(url);
        if (!urlPath.startsWith(publicPath)) {
            return null;
        }
        const segments = urlPath.substring(publicPath.length).split('/').filter(s => s !== '');
        if (segments.length === 0 || segments.some(segment => !StorageApiHelper.isValidName(segment))) {
            return null;
        }
        const candidate = segments[0] === StorageApiHelper.BOX_MEDIA_FOLDER
            ? path.join(this.getBoxGamesPath(), ...segments.slice(1))
            : path.join(this.getUsbPath(), ...segments);
        return await this.exists(candidate) ? candidate : null;
    }

    // ---- helpers ----

    private async listFolder(root: string, relativePath: string, hiddenDirectory?: string): Promise<IStorageFolder> {
        const directory = this.resolvePath(root, relativePath);
        let dirEntries;
        try {
            dirEntries = await fs.readdir(directory, {withFileTypes: true});
        } catch (e) {
            throw new StorageError(404, `There is no folder ${relativePath}`);
        }
        const entries: IStorageEntry[] = [];
        for (const entry of dirEntries) {
            if (!StorageApiHelper.isValidName(entry.name) || path.join(directory, entry.name) === hiddenDirectory) {
                continue;
            }
            const isMediaFile = entry.isFile() && FileExtensionsService.isSupportedExtension(path.extname(entry.name));
            if (entry.isDirectory() || isMediaFile) {
                try {
                    const stats = await fs.stat(path.join(directory, entry.name));
                    entries.push({
                        name: entry.name,
                        type: entry.isDirectory() ? 'directory' : 'file',
                        size: entry.isDirectory() ? undefined : stats.size,
                        modified: stats.mtime.toISOString()
                    });
                } catch (e) {
                    // removed meanwhile
                }
            }
        }
        entries.sort((a, b) => (a.type === b.type ? 0 : a.type === 'directory' ? -1 : 1)
            || a.name.localeCompare(b.name, undefined, {numeric: true, sensitivity: 'base'}));
        return {path: this.normalizeRelativePath(relativePath), entries};
    }

    /**
     * The supported media below the directory; folders without media are left out, except the root
     */
    private async buildTree(directory: string, relativePath: string, name: string, isRoot = false): Promise<IDirectoryTree | null> {
        let entries;
        try {
            entries = await fs.readdir(directory, {withFileTypes: true});
        } catch (e) {
            return isRoot ? {path: '', name, size: 0, type: 'directory', children: []} : null;
        }
        const children: IDirectoryTree[] = [];
        for (const entry of entries) {
            if (!StorageApiHelper.isValidName(entry.name)) {
                continue;
            }
            const childPath = StorageApiHelper.joinPath(relativePath, entry.name);
            if (entry.isDirectory()) {
                const subtree = await this.buildTree(path.join(directory, entry.name), childPath, entry.name);
                if (subtree != null) {
                    children.push(subtree);
                }
            } else if (entry.isFile() && FileExtensionsService.isSupportedExtension(path.extname(entry.name))) {
                const stats = await fs.stat(path.join(directory, entry.name)).catch(() => null);
                children.push({path: childPath, name: entry.name, size: stats?.size ?? 0, type: 'file', extension: path.extname(entry.name).toLowerCase()});
            }
        }
        if (children.length === 0 && !isRoot) {
            return null;
        }
        children.sort((a, b) => a.name.localeCompare(b.name, undefined, {numeric: true, sensitivity: 'base'}));
        return {path: relativePath, name, size: children.reduce((sum, child) => sum + child.size, 0), type: 'directory', children};
    }

    /**
     * Stores an uploaded media file. It is written next to the target under a hidden name first, so a broken upload
     * doesn't leave half a file behind.
     */
    private async storeFile(root: string, relativePath: string, content: Readable, overwrite: boolean): Promise<IStorageEntry> {
        const file = this.resolvePath(root, relativePath);
        if (file === root) {
            throw new StorageError(400, 'No file name given');
        }
        if (!FileExtensionsService.isSupportedExtension(path.extname(file))) {
            throw new StorageError(400, `${path.basename(file)} is no supported media file`);
        }
        if (!overwrite && await this.exists(file)) {
            throw new StorageError(409, `There already is a file ${path.basename(file)}`);
        }
        await fs.mkdir(path.dirname(file), {recursive: true}).catch(e => { throw this.toWriteError(e); });
        const temporaryFile = this.getTemporaryFile(file);
        try {
            await pipelineAsync(content, createWriteStream(temporaryFile));
            // the stick may be pulled out right after the upload
            await this.syncFile(temporaryFile);
            await fs.rename(temporaryFile, file);
        } catch (e) {
            await fs.unlink(temporaryFile).catch(() => undefined);
            throw this.toWriteError(e);
        }
        const stats = await fs.stat(file);
        return {name: path.basename(file), type: 'file', size: stats.size, modified: stats.mtime.toISOString()};
    }

    private async writeJsonAtomically(file: string, content: unknown, overwrite: boolean): Promise<void> {
        if (!overwrite && await this.exists(file)) {
            throw new StorageError(409, `${path.basename(file)} already exists`);
        }
        const temporaryFile = this.getTemporaryFile(file);
        try {
            await fs.writeFile(temporaryFile, JSON.stringify(content), 'utf8');
            await this.syncFile(temporaryFile);
            await fs.rename(temporaryFile, file);
        } catch (e) {
            await fs.unlink(temporaryFile).catch(() => undefined);
            throw this.toWriteError(e);
        }
    }

    private async readJson<T>(file: string, notFoundMessage: string): Promise<T> {
        let content: string;
        try {
            content = await fs.readFile(file, 'utf8');
        } catch (e) {
            throw new StorageError(404, notFoundMessage);
        }
        try {
            return JSON.parse(content);
        } catch (e) {
            throw new StorageError(500, `${path.basename(file)} is broken`);
        }
    }

    private async readJsonOrNull<T>(file: string): Promise<T | null> {
        try {
            return await this.readJson<T>(file, '');
        } catch (e) {
            if (e instanceof StorageError && e.status === 500) {
                LoggerService.warn(`Ignoring the broken file ${file}`);
            }
            return null;
        }
    }

    private async listJsonNames(directory: string): Promise<string[]> {
        let entries;
        try {
            entries = await fs.readdir(directory, {withFileTypes: true});
        } catch (e) {
            return [];
        }
        return entries
            .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith(StorageApiHelper.JSON_EXTENSION))
            .map(entry => entry.name.substring(0, entry.name.length - StorageApiHelper.JSON_EXTENSION.length))
            .filter(name => StorageApiHelper.isValidName(name));
    }

    /**
     * The base, or the base with a number if a file or folder with it and the extension exists already
     * @return without the extension
     */
    private async makeUniqueName(directory: string, base: string, extension: string): Promise<string> {
        let name = base;
        for (let i = 2; await this.exists(path.join(directory, name + extension)); i++) {
            name = `${base} (${i})`;
        }
        return name;
    }

    private normalizeRelativePath(relativePath: string): string {
        return (relativePath ?? '').split('/').filter(segment => segment !== '').join('/');
    }

    /**
     * The absolute path of a path below the root. Every folder and file name has to be valid, so it can't leave the
     * root or point to hidden files.
     */
    private resolvePath(root: string, relativePath: string): string {
        if (relativePath != null && typeof relativePath !== 'string') {
            throw new StorageError(400, 'Invalid path');
        }
        const segments = this.normalizeRelativePath(relativePath).split('/').filter(segment => segment !== '');
        if (segments.some(segment => !StorageApiHelper.isValidName(segment))) {
            throw new StorageError(400, `Invalid path ${relativePath}`);
        }
        return path.join(root, ...segments);
    }

    private isInside(file: string, directory: string): boolean {
        return file === directory || file.startsWith(directory + path.sep);
    }

    private getTemporaryFile(file: string): string {
        return path.join(path.dirname(file), `.${path.basename(file)}.${Uuid.v4()}.part`);
    }

    private async syncFile(file: string): Promise<void> {
        const handle = await fs.open(file, 'r+');
        try {
            await handle.sync();
        } finally {
            await handle.close();
        }
    }

    private async removeRecursively(directory: string): Promise<void> {
        // fs.rm is newer than some boxes' Node.js
        const rm = (fs as unknown as {rm?: (p: string, o: object) => Promise<void>}).rm;
        try {
            if (rm != null) {
                await rm.call(fs, directory, {recursive: true, force: true});
            } else {
                await fs.rmdir(directory, {recursive: true});
            }
        } catch (e) {
            throw this.toWriteError(e);
        }
    }

    private async exists(file: string): Promise<boolean> {
        return (await fs.stat(file).catch(() => null)) != null;
    }

    private async isFile(file: string): Promise<boolean> {
        return (await fs.stat(file).catch(() => null))?.isFile() ?? false;
    }

    private async isDirectory(file: string): Promise<boolean> {
        return (await fs.stat(file).catch(() => null))?.isDirectory() ?? false;
    }

    private toWriteError(e: any): Error {
        if (e instanceof StorageError) {
            return e;
        }
        if (e?.code === 'ENOSPC') {
            return new StorageError(507, 'Not enough space left');
        }
        if (e?.code === 'EROFS' || e?.code === 'EACCES' || e?.code === 'EPERM') {
            return new StorageError(403, 'The storage is read-only');
        }
        if (e?.code === 'ENOENT') {
            return new StorageError(404, 'The storage is gone, was the USB stick pulled out?');
        }
        LoggerService.error('Could not write to the storage', e);
        return new StorageError(500, 'Could not write to the storage');
    }
}
