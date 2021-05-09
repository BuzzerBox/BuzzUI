import express from 'express';
import * as http from 'http';
import * as WebSocket from 'ws';
import config from '../shared/config.json';

const main = express();

//initialize a simple http server
const server = http.createServer(main);

//initialize the WebSocket server instance
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws: WebSocket) => {

    //connection is up, let's add a simple simple event
    ws.on('message', (message: string) => {

        //log the received message and send it back to the client
        console.log('received: %s', message);
        ws.send(`Hello, you sent -> ${message}`);
    });

    //send immediatly a feedback to the incoming connection
    ws.send('Hi there, I am a WebSocket server');
});

//start our server
server.listen(config.server.port, () => {
    console.log(`Server started on port ${config.server.port} :)`);
});
