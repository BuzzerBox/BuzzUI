import {Injectable, OnDestroy} from '@angular/core';
import {webSocket, WebSocketSubject} from 'rxjs/webSocket';
import config from '../../../../config.json';
import {Subscription} from 'rxjs';
import {IWebSocketMessage, IResponsePacket} from '../../../../shared/shared';

/**
 * Followed https://rxjs-dev.firebaseapp.com/api/webSocket/webSocket
 */
@Injectable({
  providedIn: 'root'
})
export class WebSocketService implements OnDestroy {
  // The connection to the server
  private subject: WebSocketSubject<IWebSocketMessage>;
  // Note that at least one consumer has to subscribe to the created subject - otherwise "nexted" values will be just buffered and not sent,
  // since no connection was established!
  private mandatorySubscription: Subscription;

  constructor() {
    this.subject = webSocket(config.server.webSocketProtocol + '://' + config.server.address + ':' + config.server.port);
    this.mandatorySubscription = this.subject.subscribe();
  }

  ngOnDestroy(): void {
    this.subject.complete();
    this.mandatorySubscription.unsubscribe();
  }

  public send<T extends IWebSocketMessage>(webSocketMessage: T): void {
    // This will send a message to the server once a connection is made. Remember, value is serialized with JSON.stringify by default!
    this.subject.next(webSocketMessage);
  }

  public listen(callbackOnMessage: (message: IWebSocketMessage) => void): Subscription {
    return this.subject.subscribe(callbackOnMessage);
  }
}
