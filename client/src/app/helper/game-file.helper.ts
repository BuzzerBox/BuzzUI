import {
  CURRENT_GAME_FORMAT_VERSION,
  CURRENT_SAVEGAME_VERSION,
  GameFormatHelper,
  IGameBundle,
  IGameDefinition,
  IGameInstanceState,
  IGameState,
  IQuestion,
  ITeam,
  PacketHelper,
  StorageApiHelper
} from '../../../../shared/shared';
import {FormatHelper} from './format.helper';

/**
 * A savegame from before games and states were stored apart, as it was downloaded to a device
 */
export interface ILegacySaveGame {
  version: number;
  teams: ITeam[];
  question: IQuestion[];
  gameState: IGameState | null;
}

export class GameFileHelper {
  private constructor() {
    // making it private to avoid this class being instantiated
  }

  /**
   * Makes a bundle out of a file from a device: a bundle in the current format (see GameFormatHelper), or an old
   * savegame converted. Old savegames that were never played (downloaded from the setup) become a game without state.
   * @throws Error if it is neither
   */
  public static toBundle(json: unknown, fileName: string): IGameBundle {
    const file = json as Partial<IGameBundle & ILegacySaveGame>;
    if (file?.kind === 'bundle') {
      const game = GameFormatHelper.migrateDefinition(file.game);
      if (game == null) {
        throw new Error('Das Spiel ist kaputt oder mit einer neueren Version der BuzzerBox gemacht.');
      }
      const bundle: IGameBundle = {...file as IGameBundle, formatVersion: CURRENT_GAME_FORMAT_VERSION, game};
      if (bundle.state != null) {
        bundle.state = GameFormatHelper.migrateState(bundle.state, game);
      }
      return bundle;
    }
    if ((file?.version === CURRENT_SAVEGAME_VERSION || file?.version === 2) && Array.isArray(file.question)) {
      return this.convertLegacySaveGame(file as ILegacySaveGame, fileName);
    }
    throw new Error('Die Datei ist kein Spiel und kein Spielstand.');
  }

  private static convertLegacySaveGame(saveGame: ILegacySaveGame, fileName: string): IGameBundle {
    const now = new Date().toISOString();
    // the questions of a savegame are one round, as in versions from before rounds
    const game: IGameDefinition = GameFormatHelper.migrateDefinition({kind: 'game', version: 1, savedAt: now, questions: saveGame.question});
    const bundle: IGameBundle = {formatVersion: CURRENT_GAME_FORMAT_VERSION, kind: 'bundle', gameName: this.getBaseName(fileName), game};
    let gameState = saveGame.gameState;
    if (gameState != null) {
      if (saveGame.version === 2) {
        // version 2 had mediaState (EVideoStates) instead of mediaQuestionState, see CURRENT_SAVEGAME_VERSION
        gameState = {...gameState};
        delete (gameState as {mediaState?: unknown}).mediaState;
        gameState.mediaQuestionState ??= PacketHelper.getDefaultMediaState();
        gameState.mediaVolume ??= PacketHelper.getDefaultMediaVolume();
      }
      bundle.state = {
        formatVersion: CURRENT_GAME_FORMAT_VERSION,
        kind: 'state',
        gameVersion: 1,
        createdAt: now,
        updatedAt: now,
        finished: false,
        teams: saveGame.teams ?? [],
        gameState: GameFormatHelper.migrateGameState(gameState, game.rounds)
      };
      bundle.stateName = 'Importiert';
    }
    return bundle;
  }

  public static makeBundle(gameName: string, game: IGameDefinition, state?: IGameInstanceState, stateName?: string): IGameBundle {
    return {formatVersion: CURRENT_GAME_FORMAT_VERSION, kind: 'bundle', gameName, game, state, stateName};
  }

  /**
   * A file name without its extension, as a valid name
   */
  public static getBaseName(fileName: string): string {
    return StorageApiHelper.sanitizeName(fileName.replace(/(\.buzzerbox)?\.(tar\.gz|tgz)$|\.json$/i, '')) || 'Importiertes Spiel';
  }

  /**
   * Whether the file is an archive of a whole game with its media, rather than a game file or savegame (JSON)
   */
  public static isArchive(fileName: string): boolean {
    return /\.(tar\.gz|tgz)$/i.test(fileName);
  }

  /**
   * The name a new state gets: when it was started
   */
  public static makeStateName(): string {
    return FormatHelper.makeTimestampedName('Spiel');
  }

  /**
   * Saves JSON as a file on this device
   */
  public static download(fileName: string, content: unknown): void {
    const blob = new Blob([JSON.stringify(content)], {type: 'application/json'});
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    // the browser reads the blob asynchronously after the click, so it must not be revoked right away
    setTimeout(() => window.URL.revokeObjectURL(url), 1000);
  }
}
