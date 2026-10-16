import {Injectable, OnDestroy} from '@angular/core';
import {webSocket, WebSocketSubject} from 'rxjs/webSocket';
import {Observable, Subject, Subscription} from 'rxjs';
import {IWebSocketMessage} from '../../../../shared/shared';
import {AbstractLoggerService} from '../../../../shared/services/abstract-logger.service';
import {ConfigService} from './config.service';

/**
 * Followed https://rxjs-dev.firebaseapp.com/api/webSocket/webSocket
 *
 * Keeps one connection to the server and connects again whenever it is lost.
 */
@Injectable({
  providedIn: 'root'
})
export class WebSocketService implements OnDestroy {
  // The current connection to the server; while there is none, this waits for the next one
  private connection: Promise<WebSocketSubject<IWebSocketMessage>>;
  private resolveConnection: (connection: WebSocketSubject<IWebSocketMessage>) => void;
  private currentSubject: WebSocketSubject<IWebSocketMessage>;
  // all messages from the server, across reconnects
  private messages = new Subject<IWebSocketMessage>();
  private reconnects = new Subject<void>();
  // set only while the reconnect handlers run, see connect()
  private reconnectingSubject: WebSocketSubject<IWebSocketMessage> | null = null;
  private wasConnected = false;
  private isDestroyed = false;

  constructor(
    private config: ConfigService
  ) {
    this.waitForNextConnection();
    this.connect();
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    this.currentSubject?.complete();
  }

  public async send<T extends IWebSocketMessage>(webSocketMessage: T): Promise<void> {
    // what the reconnect handlers send goes out right away, ahead of the messages that waited for the connection
    if (this.reconnectingSubject) {
      this.reconnectingSubject.next(webSocketMessage);
      return;
    }
    // This will send a message to the server once a connection is made. Remember, value is serialized with JSON.stringify by default!
    (await this.connection).next(webSocketMessage);
  }

  /**
   * Resolves once the first connection is made
   */
  public async listen(callbackOnMessage: (message: IWebSocketMessage) => void): Promise<Subscription> {
    await this.connection;
    return this.messages.subscribe(callbackOnMessage);
  }

  /**
   * Emits every time the connection is made again after it was lost. Whatever the server knew about this client
   * (e.g. that it is the master) may be gone by then.
   */
  public observeReconnects(): Observable<void> {
    return this.reconnects.asObservable();
  }

  private waitForNextConnection(): void {
    this.connection = new Promise(resolve => this.resolveConnection = resolve);
  }

  private connect(): void {
    const websocketAddress = ConfigService.getWebSocketUrl();
    const subject: WebSocketSubject<IWebSocketMessage> = webSocket(websocketAddress);
    let isOpen = false;
    this.currentSubject = subject;
    subject.subscribe({
      next: message => {
        // the server greets every new connection, so the first message means it is up
        if (!isOpen) {
          isOpen = true;
          this.onOpened(subject);
        }
        this.messages.next(message);
      },
      error: error => this.onConnectionLost(websocketAddress, isOpen, error),
      complete: () => this.onConnectionLost(websocketAddress, isOpen)
    });
  }

  private onOpened(subject: WebSocketSubject<IWebSocketMessage>): void {
    if (this.wasConnected) {
      // The server forgot this client with the old connection, so the handlers introduce it again (e.g. register the
      // master) before the messages that waited for the connection go out: the server would ignore a master's message
      // that arrives before the master is registered again.
      this.reconnectingSubject = subject;
      try {
        this.reconnects.next();
      } finally {
        this.reconnectingSubject = null;
      }
    }
    this.resolveConnection(subject);
    this.wasConnected = true;
  }

  private onConnectionLost(websocketAddress: string, wasOpen: boolean, error?: unknown): void {
    if (this.isDestroyed) {
      return;
    }
    if (wasOpen) {
      // messages sent from now on wait for the next connection
      this.waitForNextConnection();
    }
    const websocketRetryDelay = parseInt(ConfigService.get().server.retryIntervalInMS, 10);
    AbstractLoggerService.error(`Websocket connection to '${websocketAddress}' failed. Retry in ${websocketRetryDelay} milliseconds.`, error);
    setTimeout(() => this.connect(), websocketRetryDelay);
  }
}
