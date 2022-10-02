import { Injectable } from '@angular/core';
import {ClientGameBase} from './client-game-base';
import {WebSocketService} from '../web-socket.service';

@Injectable({
  providedIn: 'root'
})
export class ClientGameVirtualDevBoardService extends ClientGameBase {

  constructor(protected webSocketService: WebSocketService) {
    super(webSocketService);
  }
}
