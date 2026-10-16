/**
 * A folder or media file in a folder of a storage location
 */
export interface IStorageEntry {
    name: string;
    type: 'directory' | 'file';
    /**
     * In bytes; only for files
     */
    size?: number;
    /**
     * As an ISO date
     */
    modified: string;
    /**
     * Only in a game's media: the versions that show the file, or media in the folder. Versions never change, so it
     * can't be renamed, moved or deleted while they are there.
     */
    usedByVersions?: number[];
}

/**
 * The contents of a folder of a storage location's media
 */
export interface IStorageFolder {
    /**
     * Below the location's media root, without leading slash; empty for the root
     */
    path: string;
    /**
     * Folders first, then the media files, each by name
     */
    entries: IStorageEntry[];
}
