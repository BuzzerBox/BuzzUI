import { Injectable } from '@angular/core';
import {ConfigService} from './config.service';
import { HttpClient } from '@angular/common/http';
import {IDirectoryTree, StringHelper} from '../../../../shared/shared';
@Injectable({
  providedIn: 'root'
})
export class FileService {

  constructor(private http: HttpClient) { }

  public static getPathPrefix(): string {
    return 'http://' +
      ConfigService.getServerAddress() + ':' +
      ConfigService.get().fileServer.port +
      ConfigService.get().fileServer.publicPath;
  }

  public static buildFullPathString(partialPath: string): string {
    return StringHelper.appendWithInfixIf(FileService.getPathPrefix(), partialPath, '/', !StringHelper.isFirstChar(partialPath, '/'));
  }

  // every question in the setup shows the media, so they share one request instead of scanning the media folder each
  private static readonly MEDIA_LIST_CACHE_IN_MS = 5000;
  private mediaList: Promise<IDirectoryTree | null>;
  private mediaListRequestedAt = 0;

  /**
   * The media folder as a tree, or null if there are no media or the file server can't be reached
   */
  getMediaList(): Promise<IDirectoryTree | null> {
    if (this.mediaList == null || Date.now() - this.mediaListRequestedAt > FileService.MEDIA_LIST_CACHE_IN_MS) {
      this.mediaListRequestedAt = Date.now();
      this.mediaList = this.http.get<IDirectoryTree>(FileService.getPathPrefix()).toPromise().catch(error => {
        console.error('Could not load the media list', error);
        return null;
      });
    }
    return this.mediaList;
  }
}
