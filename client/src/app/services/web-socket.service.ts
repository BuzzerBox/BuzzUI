import {Injectable, OnDestroy} from '@angular/core';
import {webSocket, WebSocketSubject} from 'rxjs/webSocket';
import config from '../../../../config.json';
import {Observable, Subscription} from 'rxjs';
import {IWebSocketMessage, IResponsePacket} from '../../../../shared/shared';
import {tryCatch} from "rxjs/internal-compatibility";
import {delay, retryWhen, tap} from "rxjs/operators";
import {addWarning} from "@angular-devkit/build-angular/src/utils/webpack-diagnostics";
import {parse} from "jasmine-spec-reporter/built/configuration-parser";

/**
 * Followed https://rxjs-dev.firebaseapp.com/api/webSocket/webSocket
 */
@Injectable({
  providedIn: 'root'
})
export class WebSocketService implements OnDestroy {
  // The connection to the server
//  private subject: Promise<WebSocketSubject<IWebSocketMessage>>;
  private subject: WebSocketSubject<IWebSocketMessage>;
  // Note that at least one consumer has to subscribe to the created subject - otherwise "nexted" values will be just buffered and not sent,
  // since no connection was established!
  private mandatorySubscription: Subscription;

  constructor() {
    console.log("darkwin dcuk");
    // this.subject = this.establishConnection();
    this.subject = webSocket(config.server.webSocketProtocol + '://' + config.server.address + ':' + config.server.port);
  }

  // async ngOnDestroy(): Promise<void> {
    ngOnDestroy(): void {
//     (await this.subject).complete();
      this.subject.complete();
    this.mandatorySubscription.unsubscribe();
  }

//   public async send<T extends IWebSocketMessage>(webSocketMessage: T): Promise<void> {
  public send<T extends IWebSocketMessage>(webSocketMessage: T): void {
    // This will send a message to the server once a connection is made. Remember, value is serialized with JSON.stringify by default!
//     (await this.subject).next(webSocketMessage);
    this.subject.next(webSocketMessage);
  }

  // public async listen(callbackOnMessage: (message: IWebSocketMessage) => void): Promise<Subscription> {
  public listen(callbackOnMessage: (message: IWebSocketMessage) => void): Subscription {
    // this.subject.subscribe((data) => {
    //  console.log("halleluja", data);
    // }, error => console.log("laudato si", error));
//    return (await this.subject).subscribe(callbackOnMessage);
    return this.subject.subscribe(callbackOnMessage);
  }

  private async establishConnection(): Promise<WebSocketSubject<IWebSocketMessage>> {

    return new Promise((resolve, reject) => {
      /*// tslint:disable-next-line:max-line-length
      const tmpWebSocketSubject: WebSocketSubject<IWebSocketMessage> = webSocket(config.server.webSocketProtocol + '://' + config.server.address + ':' + config.server.port);
      tmpWebSocketSubject.subscribe(_ => {
        resolve(tmpWebSocketSubject);
      }, error => {
        // TODO use logger
        console.error("connection NOT successful");
        setTimeout(() => {
          // resolve(this.establishConnection());
        }, parseInt(config.server.retryIntervalInMS, 10));
      }, () => {
        reject('What\'s going on?');
      });*/
    });
    // this.mandatorySubscription = this.subject.subscribe();
  }
}
