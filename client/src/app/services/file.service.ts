import { Injectable } from '@angular/core';
import {ConfigService} from './config.service';
import {HttpClient} from '@angular/common/http';
import {IDirectoryTree} from '../../../../shared/shared';
@Injectable({
  providedIn: 'root'
})
export class FileService {

  constructor(private http: HttpClient) { }

  getMediaList(): Promise<IDirectoryTree> {
    const path = 'http://' +
      ConfigService.get().server.address + ':' +
      ConfigService.get().fileServer.port +
      ConfigService.get().fileServer.publicPath;
    return this.http.get<IDirectoryTree>(path).toPromise();
  }
}
