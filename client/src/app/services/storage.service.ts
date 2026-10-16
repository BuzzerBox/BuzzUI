import {Injectable} from '@angular/core';
import {HttpClient, HttpErrorResponse, HttpEvent, HttpEventType, HttpHeaders, HttpParams, HttpRequest} from '@angular/common/http';
import {Observable, Subject} from 'rxjs';
import {filter, map} from 'rxjs/operators';
import {
  IDirectoryTree,
  IGameBundle,
  IGameDefinition,
  IGameImportResult,
  IGameInfo,
  IGameInstanceState,
  IGameVersionInfo,
  IQuestion,
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
      return error.error?.error ?? error.message;
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
   * The questions of a game version as they are played: with the URLs of their media
   */
  public static resolveMediaUrls(ref: IGameRef, questions: IQuestion[]): IQuestion[] {
    return questions.map(question => {
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
   * @param version a version number, or "latest"
   */
  public getVersion(ref: IGameRef, version: number | 'latest'): Promise<IGameDefinition> {
    return this.http.get<IGameDefinition>(this.gameUrl(ref, 'versions', String(version)), {headers: this.headers()}).toPromise();
  }

  /**
   * Saves the questions as a new version, unless they are the same as in the latest one
   */
  public saveVersion(ref: IGameRef, questions: IQuestion[]): Promise<IGameVersionInfo & {unchanged: boolean}> {
    return this.http.post<IGameVersionInfo & {unchanged: boolean}>(this.gameUrl(ref, 'versions'), {questions}, {headers: this.headers()}).toPromise();
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
