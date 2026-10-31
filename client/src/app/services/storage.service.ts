import {Injectable} from '@angular/core';
import {HttpClient, HttpErrorResponse, HttpEvent, HttpEventType, HttpHeaders, HttpParams, HttpRequest} from '@angular/common/http';
import {Observable, Subject} from 'rxjs';
import {filter, map} from 'rxjs/operators';
import {
  IDirectoryTree,
  IGameBundle,
  IGameDefinition,
  IMediaQuestionDefaults,
  IGameCopyResult,
  IGameImportResult,
  IGameInfo,
  IGameInstanceState,
  IGameVersionInfo,
  IRound,
  GameFormatHelper,
  IStorageEntry,
  IStorageFolder,
  IStorageLocation,
  StorageApiHelper
} from '../../../../shared/shared';
import {ConfigService} from './config.service';
import {GameService} from './game.service';

/**
 * The progress of an upload: the share that was sent, from 0 to 1, until it is done with the stored file
 */
export interface IUploadProgress {
  progress: number;
  entry?: IStorageEntry;
}

export interface IArchiveImportProgress {
  progress: number;
  result?: IGameImportResult;
}

/**
 * A game on a location
 */
export interface IGameRef {
  location: IStorageLocation;
  gameName: string;
}

/**
 * The games on the box and the USB sticks, through the storage API of the server (see StorageApiHelper). Only the
 * master can use it.
 */
@Injectable({
  providedIn: 'root'
})
export class StorageService {
  // the game whose media changed, so every media picker of it shows them anew
  private readonly gameMediaChangedSubject = new Subject<IGameRef>();

  constructor(private http: HttpClient, private game: GameService) { }

  /**
   * The message of a failed request, as the server explains it
   */
  public static getErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        return 'Die BuzzerBox ist nicht erreichbar.';
      }
      if (error.status === 401) {
        return 'Nur die Spielleitung kann auf den Speicher zugreifen.';
      }
      if (error.status === 507) {
        return 'Es ist nicht genug Speicherplatz frei.';
      }
      if (typeof error.error?.error === 'string') {
        return error.error.error;
      }
      if (error.status >= 200 && error.status < 300) {
        // the answer wasn't JSON, e.g. the web page itself, when a reverse proxy doesn't pass the storage API through
        return 'Die BuzzerBox hat keine gültige Antwort geschickt.';
      }
      return error.message;
    }
    return error instanceof Error ? error.message : String(error);
  }

  /**
   * Whether the request failed since the target already exists or is in use
   */
  public static isConflict(error: unknown): boolean {
    return error instanceof HttpErrorResponse && error.status === 409;
  }

  public static getLocationLabel(location: IStorageLocation): string {
    return location.type === 'box' ? 'BuzzerBox' : 'USB-Stick ' + location.name;
  }

  /**
   * The location as it follows "auf", e.g. "auf der BuzzerBox"
   */
  public static getLocationText(location: IStorageLocation): string {
    return location.type === 'box' ? 'der BuzzerBox' : 'dem USB-Stick ' + location.name;
  }

  /**
   * The URL of a media file of a game, as the screens load it
   */
  public static getGameMediaUrl(ref: IGameRef, relativePath: string): string {
    const treePath = StorageApiHelper.joinPath(StorageApiHelper.getGameMediaPath(ref.location.gamesPath, ref.gameName), relativePath);
    return ConfigService.getMediaUrl() + StorageApiHelper.encodePath(treePath);
  }

  /**
   * The URL of a USB stick's other media
   */
  public static getStickMediaUrl(location: IStorageLocation, relativePath: string): string {
    return ConfigService.getMediaUrl() + StorageApiHelper.encodePath(StorageApiHelper.joinPath(location.mediaPath, relativePath));
  }

  /**
   * The rounds of a game version as they are played: with the URLs of the media of their questions
   */
  public static resolveMediaUrls(ref: IGameRef, rounds: IRound[]): IRound[] {
    return GameFormatHelper.mapQuestions(rounds, question => {
      if (!question.mediaDetails?.fileSrc) {
        return question;
      }
      return {
        ...question,
        mediaDetails: {
          ...question.mediaDetails,
          fileSrc: this.getGameMediaUrl(ref, question.mediaDetails.fileSrc),
          slides: question.mediaDetails.slides?.map(slide => this.getGameMediaUrl(ref, slide))
        }
      };
    });
  }

  public isAvailable(): boolean {
    return this.game.getStorageToken() != null;
  }

  public observeGameMediaChanges(): Observable<IGameRef> {
    return this.gameMediaChangedSubject.asObservable();
  }

  public getLocations(): Promise<IStorageLocation[]> {
    return this.http.get<IStorageLocation[]>(this.url('locations'), {headers: this.headers()}).toPromise();
  }

  public async getLocation(id: string): Promise<IStorageLocation | null> {
    return (await this.getLocations()).find(location => location.id === id) ?? null;
  }

  // ---- games ----

  public listGames(location: IStorageLocation): Promise<IGameInfo[]> {
    return this.http.get<IGameInfo[]>(this.url('locations', location.id, 'games'), {headers: this.headers()}).toPromise();
  }

  public async getGame(ref: IGameRef): Promise<IGameInfo | null> {
    return (await this.listGames(ref.location)).find(game => game.name === ref.gameName) ?? null;
  }

  public createGame(ref: IGameRef): Promise<IGameInfo> {
    return this.http.post<IGameInfo>(this.gameUrl(ref), null, {headers: this.headers()}).toPromise();
  }

  public deleteGame(ref: IGameRef): Promise<void> {
    return this.http.delete<void>(this.gameUrl(ref), {headers: this.headers()}).toPromise();
  }

  /**
   * Where the browser downloads the game as an archive with its versions, states and media. The browser can't send the
   * token header for a download, so the URL has a ticket for one download within a minute.
   */
  public async getGameArchiveUrl(ref: IGameRef): Promise<string> {
    const {ticket} = await this.http.post<{ticket: string}>(this.gameUrl(ref, 'archive-ticket'), null, {headers: this.headers()}).toPromise();
    const params = new HttpParams().set(StorageApiHelper.DOWNLOAD_TICKET_QUERY_PARAMETER, ticket);
    return this.gameUrl(ref, 'archive') + '?' + params.toString();
  }

  /**
   * Uploads an archive of getGameArchiveUrl, which becomes a new game
   */
  public importGameArchive(location: IStorageLocation, name: string, file: File): Observable<IArchiveImportProgress> {
    const request = new HttpRequest('POST', this.url('locations', location.id, 'import-archive'), file, {
      headers: this.headers().set('Content-Type', 'application/gzip'),
      params: new HttpParams().set('name', name),
      reportProgress: true
    });
    return this.http.request<IGameImportResult>(request).pipe(
      filter((event: HttpEvent<IGameImportResult>) => event.type === HttpEventType.UploadProgress || event.type === HttpEventType.Response),
      map(event => {
        if (event.type === HttpEventType.Response) {
          return {progress: 1, result: event.body};
        }
        const total = event.type === HttpEventType.UploadProgress ? event.total : undefined;
        // the box still checks and saves the game after the upload
        return {progress: total ? Math.min(event.loaded / total, 0.99) : 0};
      })
    );
  }

  /**
   * Copies a game with its versions, states and media to another location; move deletes the original afterwards
   */
  public copyGame(ref: IGameRef, to: IStorageLocation, name: string, move: boolean): Promise<IGameCopyResult> {
    return this.http.post<IGameCopyResult>(this.gameUrl(ref, 'copy'), {toLocation: to.id, name, move}, {headers: this.headers()}).toPromise();
  }

  /**
   * @param version a version number, or "latest"
   */
  public getVersion(ref: IGameRef, version: number | 'latest'): Promise<IGameDefinition> {
    return this.http.get<IGameDefinition>(this.gameUrl(ref, 'versions', String(version)), {headers: this.headers()}).toPromise();
  }

  /**
   * Saves the rounds and media defaults as a new version, unless they are the same as in the latest one
   */
  public saveVersion(ref: IGameRef, rounds: IRound[], mediaDefaults: IMediaQuestionDefaults): Promise<IGameVersionInfo & {unchanged: boolean}> {
    return this.http.post<IGameVersionInfo & {unchanged: boolean}>(this.gameUrl(ref, 'versions'), {rounds, mediaDefaults}, {headers: this.headers()}).toPromise();
  }

  public deleteVersion(ref: IGameRef, version: number): Promise<void> {
    return this.http.delete<void>(this.gameUrl(ref, 'versions', String(version)), {headers: this.headers()}).toPromise();
  }

  public getState(ref: IGameRef, stateName: string): Promise<IGameInstanceState> {
    return this.http.get<IGameInstanceState>(this.gameUrl(ref, 'states', stateName), {headers: this.headers()}).toPromise();
  }

  public deleteState(ref: IGameRef, stateName: string): Promise<void> {
    return this.http.delete<void>(this.gameUrl(ref, 'states', stateName), {headers: this.headers()}).toPromise();
  }

  public renameState(ref: IGameRef, stateName: string, newName: string): Promise<void> {
    return this.http.post<void>(this.gameUrl(ref, 'states', stateName, 'rename'), {name: newName}, {headers: this.headers()}).toPromise();
  }

  /**
   * Creates a game from a bundle or a converted old savegame, copying its media into it where they are found
   */
  public importBundle(location: IStorageLocation, gameName: string, bundle: IGameBundle): Promise<IGameImportResult> {
    return this.http.post<IGameImportResult>(this.url('locations', location.id, 'import'), bundle, {
      headers: this.headers(),
      params: new HttpParams().set('name', gameName)
    }).toPromise();
  }

  // ---- media of a game ----

  public getGameMediaTree(ref: IGameRef): Promise<IDirectoryTree> {
    return this.http.get<IDirectoryTree>(this.gameUrl(ref, 'media-tree'), {headers: this.headers()}).toPromise();
  }

  public listGameMedia(ref: IGameRef, path: string): Promise<IStorageFolder> {
    return this.http.get<IStorageFolder>(this.gameUrl(ref, 'media'), {headers: this.headers(), params: new HttpParams().set('path', path)}).toPromise();
  }

  /**
   * Uploads a file into a folder of the game's media
   */
  public uploadGameMedia(ref: IGameRef, folder: string, file: File, overwrite = false): Observable<IUploadProgress> {
    const request = new HttpRequest('PUT', this.gameUrl(ref, 'media'), file, {
      headers: this.headers().set('Content-Type', 'application/octet-stream'),
      params: this.overwriteParams(overwrite).set('path', StorageApiHelper.joinPath(folder, file.name)),
      reportProgress: true
    });
    return this.http.request<IStorageEntry>(request).pipe(
      filter((event: HttpEvent<IStorageEntry>) => event.type === HttpEventType.UploadProgress || event.type === HttpEventType.Response),
      map(event => {
        if (event.type === HttpEventType.Response) {
          this.gameMediaChangedSubject.next(ref);
          return {progress: 1, entry: event.body};
        }
        const total = event.type === HttpEventType.UploadProgress ? event.total : undefined;
        return {progress: total ? Math.min(event.loaded / total, 0.99) : 0};
      })
    );
  }

  public async createGameMediaFolder(ref: IGameRef, path: string): Promise<IStorageEntry> {
    const entry = await this.http.post<IStorageEntry>(this.gameUrl(ref, 'folders'), null, {
      headers: this.headers(),
      params: new HttpParams().set('path', path)
    }).toPromise();
    this.gameMediaChangedSubject.next(ref);
    return entry;
  }

  public async deleteGameMedia(ref: IGameRef, path: string): Promise<void> {
    await this.http.delete<void>(this.gameUrl(ref, 'media'), {headers: this.headers(), params: new HttpParams().set('path', path)}).toPromise();
    this.gameMediaChangedSubject.next(ref);
  }

  /**
   * Renames or moves a file or folder of the game's media; toPath is its new folder and name
   */
  public async moveGameMedia(ref: IGameRef, path: string, toPath: string): Promise<IStorageEntry> {
    const entry = await this.http.post<IStorageEntry>(this.gameUrl(ref, 'media', 'move'), {toPath}, {
      headers: this.headers(),
      params: new HttpParams().set('path', path)
    }).toPromise();
    this.gameMediaChangedSubject.next(ref);
    return entry;
  }

  /**
   * Copies a file or folder of a USB stick's other media into a folder of the game
   */
  public async copyIntoGame(ref: IGameRef, targetFolder: string, from: IStorageLocation, fromPath: string): Promise<IStorageEntry> {
    const entry = await this.http.post<IStorageEntry>(this.gameUrl(ref, 'media', 'copy'), {fromLocation: from.id, fromPath}, {
      headers: this.headers(),
      params: new HttpParams().set('path', targetFolder)
    }).toPromise();
    this.gameMediaChangedSubject.next(ref);
    return entry;
  }

  /**
   * The media of a USB stick that aren't in a game
   */
  public listStickMedia(location: IStorageLocation, path: string): Promise<IStorageFolder> {
    return this.http.get<IStorageFolder>(this.url('locations', location.id, 'media'), {
      headers: this.headers(),
      params: new HttpParams().set('path', path)
    }).toPromise();
  }

  private headers(): HttpHeaders {
    return new HttpHeaders().set(StorageApiHelper.TOKEN_HEADER, this.game.getStorageToken() ?? '');
  }

  private overwriteParams(overwrite: boolean): HttpParams {
    return overwrite ? new HttpParams().set('overwrite', 'true') : new HttpParams();
  }

  private gameUrl(ref: IGameRef, ...segments: string[]): string {
    return this.url('locations', ref.location.id, 'games', ref.gameName, ...segments);
  }

  private url(...segments: string[]): string {
    return ConfigService.getStorageUrl() + '/' + segments.map(segment => encodeURIComponent(segment)).join('/');
  }
}
