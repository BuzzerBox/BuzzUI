import {Injectable, OnDestroy} from '@angular/core';
import {webSocket, WebSocketSubject} from 'rxjs/webSocket';
import {Subscription} from 'rxjs';
import {IWebSocketMessage} from '../../../../shared/shared';
import {AbstractLoggerService} from '../../../../shared/services/abstract-logger.service';
import {ConfigService} from './config.service';

/**
 * Followed https://rxjs-dev.firebaseapp.com/api/webSocket/webSocket
 */
@Injectable({
  providedIn: 'root'
})
export class WebSocketService implements OnDestroy {
  // The connection to the server
 private subject: Promise<WebSocketSubject<IWebSocketMessage>>;
  // Note that at least one consumer has to subscribe to the created subject - otherwise "nexted" values will be just buffered and not sent,
  // since no connection was established!
  private mandatorySubscription: Subscription;

  constructor(
    private config: ConfigService
  ) {
    this.subject = this.establishConnection();
  }

  async ngOnDestroy(): Promise<void> {
    (await this.subject).complete();
    this.mandatorySubscription.unsubscribe();
  }

  public async send<T extends IWebSocketMessage>(webSocketMessage: T): Promise<void> {
    // This will send a message to the server once a connection is made. Remember, value is serialized with JSON.stringify by default!
    (await this.subject).next(webSocketMessage);
  }

  public async listen(callbackOnMessage: (message: IWebSocketMessage) => void): Promise<Subscription> {
   return (await this.subject).subscribe(callbackOnMessage);
  }

  private async establishConnection(): Promise<WebSocketSubject<IWebSocketMessage>> {

    return new Promise((resolve, reject) => {
      // tslint:disable-next-line:max-line-length
      const websocketAddress = ConfigService.get().server.webSocketProtocol + '://' + ConfigService.get().server.address + ':' + ConfigService.get().server.port;
      const tmpWebSocketSubject: WebSocketSubject<IWebSocketMessage> = webSocket(websocketAddress);
      tmpWebSocketSubject.subscribe(_ => {
        resolve(tmpWebSocketSubject);
      }, error => {
        const websocketRetryDelay = parseInt(ConfigService.get().server.retryIntervalInMS, 10);
        AbstractLoggerService.error(`Websocket connection to '${websocketAddress}' failed. Retry in ${websocketRetryDelay} milliseconds.`, error);
        setTimeout(() => {
          resolve(this.establishConnection());
        }, websocketRetryDelay);
      }, () => {
        reject('What\'s going on?');
      });
    });
    // this.mandatorySubscription = this.subject.subscribe();
  }
}
