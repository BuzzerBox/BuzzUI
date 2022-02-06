// found in @types/websocket
import {WebsocketConnection} from '../objects/websocket-connection';
import {IncomingMessage} from 'http';
import {BasicWebsocketServer} from '../objects/basic-websocket-server';
import {Buffer} from 'buffer';
import {RawData} from 'ws';

export interface IWebsocketClientSendOptions {
    mask?: boolean | undefined;
    binary?: boolean | undefined;
    compress?: boolean | undefined;
    fin?: boolean | undefined
}

export interface IOnNewConnectionValues {
    socket: WebsocketConnection;
    request: IncomingMessage;
}

export interface IOnConnectionCloseValues {
    server: BasicWebsocketServer;
}

export interface IOnCloseReturnValues {
    connection: WebsocketConnection;
    code: number;
    reason: Buffer;
}

export interface IOnMessageReturnValues {
    connection: WebsocketConnection;
    data: RawData;
    isBinary: boolean;
}

export interface IOnErrorReturnValues {
    error: Error
}
