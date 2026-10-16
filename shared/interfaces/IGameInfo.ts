export interface IGameVersionInfo {
    version: number;
    savedAt: string;
    questionCount: number;
    /**
     * How many states play this version; a version with states can't be deleted
     */
    stateCount: number;
    /**
     * How many media files the questions show that aren't in the game's media folder; such a version can't be played
     * as it is
     */
    missingMediaCount: number;
}

export interface IGameStateInfo {
    /**
     * The file name without ".json", which identifies it in the storage API
     */
    name: string;
    gameVersion: number;
    createdAt: string;
    updatedAt: string;
    finished: boolean;
    currentQuestionNumber: number;
    teams: {name: string, points: number}[];
}

/**
 * A game stored on the box or a USB stick, with its versions and states
 */
export interface IGameInfo {
    /**
     * The name of its folder, which identifies it in the storage API
     */
    name: string;
    /**
     * Null for a new game that wasn't saved yet
     */
    latestVersion: number | null;
    /**
     * The newest first
     */
    versions: IGameVersionInfo[];
    /**
     * The most recently played first
     */
    states: IGameStateInfo[];
    /**
     * Whether this is the game that is being played right now
     */
    inUse: boolean;
}

/**
 * Where a game that is played is stored, so the server can save its state there
 */
export interface IGameStorageRef {
    locationId: string;
    gameName: string;
    gameVersion: number;
    stateName: string;
}

/**
 * The result of importing a bundle or an old savegame
 */
/**
 * The game where it was copied or moved to
 */
export interface IGameCopyResult extends IGameInfo {
    /**
     * Only for a move: the original couldn't be removed afterwards, or only partly, e.g. since its USB stick was pulled
     * out, so the game was copied
     */
    originalKept: boolean;
}

export interface IGameImportResult {
    gameName: string;
    stateName?: string;
    /**
     * Media of the questions that couldn't be found and copied into the game, e.g. since their USB stick isn't there
     */
    missingMedia: string[];
    /**
     * Only for archives: what was in it but doesn't belong in a game, and was left out
     */
    skippedEntries?: string[];
}
