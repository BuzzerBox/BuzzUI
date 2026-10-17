/**
 * The storage API of the file server, for the games on the box and the USB sticks. Every request needs the token the
 * master got in an IStorageAccessPacket in the header TOKEN_HEADER. The download of an archive, which the browser does
 * itself without the header, takes a one-time ticket as the query parameter DOWNLOAD_TICKET_QUERY_PARAMETER instead.
 *
 * A game is a folder with its versions (versions/<n>.json, IGameDefinition), states (states/<name>.json,
 * IGameInstanceState) and media (media/). On the box, the games are in "<storage.boxPath>/games", on a USB stick in
 * GAMES_FOLDER_ON_USB. Media paths are relative to the game's media folder, with "/" between folders, and are passed
 * as the query parameter "path".
 *
 * - GET    {BASE_PATH}/locations                                     → IStorageLocation[]
 * - GET    {BASE_PATH}/locations/:id/games                           → IGameInfo[], by name
 * - POST   {BASE_PATH}/locations/:id/games/:game                     creates an empty game
 * - DELETE {BASE_PATH}/locations/:id/games/:game                     deletes it with its versions, states and media
 * - POST   {BASE_PATH}/locations/:id/games/:game/archive-ticket      → {ticket}, good for one download of the archive
 *                                                                      within a minute
 * - GET    {BASE_PATH}/locations/:id/games/:game/archive?ticket=     → the game with its versions, states and media as
 *                                                                      a tar.gz file, to bring it to another box
 * - POST   {BASE_PATH}/locations/:id/games/:game/copy                ← {toLocation, name?, move?}; copies it with its
 *                                                                      versions, states and media to another location,
 *                                                                      move deletes the original; within the same
 *                                                                      location move renames it; → IGameInfo of the copy
 * - GET    {BASE_PATH}/locations/:id/games/:game/versions/:version   → IGameDefinition; :version can be "latest"
 * - POST   {BASE_PATH}/locations/:id/games/:game/versions            ← {questions, mediaDefaults?}; → IGameVersionInfo of the new
 *                                                                      version, or of the latest if nothing changed
 * - DELETE {BASE_PATH}/locations/:id/games/:game/versions/:version   only versions without states
 * - GET    {BASE_PATH}/locations/:id/games/:game/states/:state       → IGameInstanceState
 * - POST   {BASE_PATH}/locations/:id/games/:game/states/:state/rename ← {name}
 * - DELETE {BASE_PATH}/locations/:id/games/:game/states/:state
 * - GET    {BASE_PATH}/locations/:id/games/:game/media-tree          → IDirectoryTree, paths relative to the media
 * - GET    {BASE_PATH}/locations/:id/games/:game/media?path=         → IStorageFolder
 * - PUT    {BASE_PATH}/locations/:id/games/:game/media?path=a/b.mp4  ← the file; ?overwrite=true replaces one
 * - POST   {BASE_PATH}/locations/:id/games/:game/folders?path=       creates a folder
 * - DELETE {BASE_PATH}/locations/:id/games/:game/media?path=         a file or folder no version uses
 * - POST   {BASE_PATH}/locations/:id/games/:game/media/move?path=    ← {toPath}; renames or moves a file or folder no
 *                                                                      version uses; → IStorageEntry
 * - POST   {BASE_PATH}/locations/:id/games/:game/media/copy?path=    ← {fromLocation, fromPath}; copies a file or folder
 *                                                                      of a USB stick's other media into the folder
 * - GET    {BASE_PATH}/locations/:id/media?path=                     → IStorageFolder of a USB stick's other media
 * - POST   {BASE_PATH}/locations/:id/import?name=                    ← IGameBundle, whose media may be URLs of
 *                                                                      media on the box; → IGameImportResult
 * - POST   {BASE_PATH}/locations/:id/import-archive?name=            ← an archive of a game; → IGameImportResult
 *
 * Errors are answered with a status code and {error: string}, 409 if the target already exists or is in use.
 */
export class StorageApiHelper {
    public static readonly BASE_PATH = '/storage';
    public static readonly TOKEN_HEADER = 'X-BuzzerBox-Token';
    public static readonly DOWNLOAD_TICKET_QUERY_PARAMETER = 'ticket';
    public static readonly GAME_ARCHIVE_EXTENSION = '.buzzerbox.tar.gz';
    public static readonly BOX_LOCATION_ID = 'box';
    public static readonly USB_LOCATION_ID_PREFIX = 'usb:';
    /**
     * Where the box's games appear below the media URL, next to the USB sticks
     */
    public static readonly BOX_MEDIA_FOLDER = 'BuzzerBox';
    public static readonly GAMES_FOLDER_ON_USB = 'buzzerbox-games';
    public static readonly GAME_MEDIA_FOLDER = 'media';
    public static readonly JSON_EXTENSION = '.json';
    // characters that a USB stick's FAT file system doesn't allow, besides the path separators, and the ones that
    // would have to be escaped in URLs
    private static readonly INVALID_NAME_CHARACTERS = /[\\/:*?"<>|#%\u0000-\u001f]/;
    private static readonly MAX_NAME_LENGTH = 200;

    private constructor() {
        // making it private to avoid this class being instantiated
    }

    public static makeUsbLocationId(stickName: string): string {
        return this.USB_LOCATION_ID_PREFIX + stickName;
    }

    /**
     * Whether a file or folder may have this name: not empty or hidden (starting with "."), and without characters that
     * USB sticks don't allow
     */
    public static isValidName(name: string): boolean {
        return typeof name === 'string'
            && name.trim() === name
            && name.length > 0
            && name.length <= this.MAX_NAME_LENGTH
            && !name.startsWith('.')
            && !this.INVALID_NAME_CHARACTERS.test(name);
    }

    /**
     * Whether it is a relative path of valid names, like "folder/image.png"
     */
    public static isValidRelativePath(path: string): boolean {
        return typeof path === 'string' && path.split('/').every(segment => this.isValidName(segment));
    }

    /**
     * Makes a valid name out of what was typed in, e.g. for a game; empty if nothing is left of it
     */
    public static sanitizeName(name: string): string {
        return (name ?? '')
            .replace(new RegExp(this.INVALID_NAME_CHARACTERS.source, 'g'), '-')
            .trim()
            .replace(/^\.+/, '')
            .slice(0, this.MAX_NAME_LENGTH)
            .trim();
    }

    /**
     * Joins paths or names to a path as the API takes it, leaving out empty parts
     */
    public static joinPath(...parts: string[]): string {
        return parts.filter(part => !!part).join('/');
    }

    /**
     * Where a game's media are below the media URL
     */
    public static getGameMediaPath(gamesPath: string, gameName: string): string {
        return [gamesPath, gameName, this.GAME_MEDIA_FOLDER].join('/');
    }

    /**
     * A path below the media URL as it goes into a URL, every folder and file name escaped
     */
    public static encodePath(path: string): string {
        return path.split('/').map(segment => encodeURIComponent(segment)).join('/');
    }
}
