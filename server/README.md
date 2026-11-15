# Server

The game server of the BuzzerBox (Node.js, Express, `ws`). It holds the game state and is its only source of truth.
It talks to the game master and the screens over a WebSocket (port 4201), serves media and the storage API over HTTP
(port 4202), and reads the buzzers: the box's microcontroller over the serial port, and wireless buzzers over UDP
(port 5005) and USB.

```sh
cp ../config.dev.json.example ../config.dev.json   # once; the build imports it
npm install
npm run startDev     # virtual serial port (needs socat), compile, run in dev mode
npm run transpile    # compile to dist/; the entry point is dist/server/main.js
npm start            # run the compiled server with the production config
npm start -- --dev=1 # ... with config.dev.json
```

`config.json` and `config.dev.json` are compiled in, so run `npm run transpile` again after changing them. There are
no server tests.

## Where things are

| Path | What |
|---|---|
| `main.ts` | Starts the services |
| `services/game.service.ts` | The game automaton and the packet dispatch |
| `services/serial-port.service.ts`, `objects/adapters/` | The box's microcontroller |
| `services/udp-buzzer.service.ts` | Wireless buzzers over WiFi |
| `services/buzzer-provisioning.service.ts` | Adopting wireless buzzers over USB |
| `services/storage.service.ts`, `storage-api.service.ts` | Games on the box and on USB sticks, and their REST API |
| `services/autosave.service.ts` | Saving the running game |
| `services/file-server.service.ts` | Serving media |
| `services/update.service.ts` | Finding and installing USB updates |
| `docker/` | The image of the test environment |

See the [development setup](../docs/development.md), the [architecture](../docs/architecture.md) and the
[configuration reference](../docs/configuration.md).
