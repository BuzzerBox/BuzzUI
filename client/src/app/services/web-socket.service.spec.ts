import { TestBed } from '@angular/core/testing';
import {WebSocketSubject} from 'rxjs/webSocket';

import { WebSocketService } from './web-socket.service';
import {EPacketTypes, IWebSocketMessage} from '../../../../shared/shared';

// stands in for a connection to the server and records what is sent over it
class FakeConnection {
  public sent: IWebSocketMessage[] = [];

  public next(message: IWebSocketMessage): void {
    this.sent.push(message);
  }
}

describe('WebSocketService', () => {
  let service: WebSocketService;
  // the private parts that connect() and onConnectionLost() drive
  let internals: {
    onOpened: (subject: WebSocketSubject<IWebSocketMessage>) => void;
    waitForNextConnection: () => void;
  };

  const open = (connection: FakeConnection): void =>
    internals.onOpened(connection as unknown as WebSocketSubject<IWebSocketMessage>);

  beforeEach(() => {
    // no real connection to a server
    spyOn(WebSocketService.prototype as unknown as {connect: () => void}, 'connect');
    TestBed.configureTestingModule({});
    service = TestBed.inject(WebSocketService);
    internals = service as unknown as typeof internals;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('sends what waited for the first connection once it is made', async () => {
    const sending = service.send({packetType: EPacketTypes.REGISTER_MASTER});
    const connection = new FakeConnection();
    open(connection);
    await sending;
    expect(connection.sent.map(message => message.packetType)).toEqual([EPacketTypes.REGISTER_MASTER]);
  });

  it('sends what the reconnect handlers send before what waited for the connection', async () => {
    open(new FakeConnection());
    service.observeReconnects().subscribe(() => service.send({packetType: EPacketTypes.REGISTER_MASTER}));

    // the connection is lost, and the master starts the game meanwhile
    internals.waitForNextConnection();
    const waiting = service.send({packetType: EPacketTypes.SETUP_GAME});
    const connection = new FakeConnection();
    open(connection);
    await waiting;

    expect(connection.sent.map(message => message.packetType))
      .toEqual([EPacketTypes.REGISTER_MASTER, EPacketTypes.SETUP_GAME]);
  });
});
