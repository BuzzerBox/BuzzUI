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
