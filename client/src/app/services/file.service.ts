import { Injectable } from '@angular/core';
import {ConfigService} from './config.service';
import {HttpClient} from '@angular/common/http';
import {IDirectoryTree, StringHelper} from '../../../../shared/shared';
@Injectable({
  providedIn: 'root'
})
export class FileService {

  constructor(private http: HttpClient) { }

  public static getPathPrefix(): string {
    return 'http://' +
      ConfigService.get().server.address + ':' +
      ConfigService.get().fileServer.port +
      ConfigService.get().fileServer.publicPath;
  }

  public static buildFullPathString(partialPath: string): string {
    return StringHelper.appendWithInfixIf(FileService.getPathPrefix(), partialPath, '/', !StringHelper.isFirstChar(partialPath, '/'));
  }

  getMediaList(): Promise<IDirectoryTree> {
    const path = FileService.getPathPrefix();
    return this.http.get<IDirectoryTree>(path).toPromise();
  }
}
