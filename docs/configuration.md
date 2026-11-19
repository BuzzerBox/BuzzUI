# Configuration reference

`config.json` in the root of the repository configures the server and the client. Both **import it at build time**,
so a change needs a new build of both (for the server: `npm run transpile`). The settings that differ from box to box
are not here but in `buzzerbox.txt`, see the [box settings reference](box-settings.md).

## Layers

| File | Used | How |
|---|---|---|
| `config.json` | always | The values of a box. |
| `config.dev.json` | in dev mode | Merged over `config.json` at run time (`defaultsDeep`): the server is in dev mode when started with `--dev=1`, the client in a development build (`isDevMode()`). Not in git; copy `config.dev.json.example`. It has to exist for every build, also production ones, since the code imports it. |
| `config.test.json` | in the test environment's images | Merged into `config.json` when the Docker images are built (`scripts/merge-config.js`, build argument `CONFIG_OVERRIDE`), so those images run the production code paths. |

`config.dev.json.example` sets the server to `localhost`, the sticks to `server/media`, the box's storage to
`server/box-storage`, the serial port to `/tmp/ttyV0`, turns the browser's keys into buzzers and turns updates off.
`config.test.json` turns on the keys and `reverseProxy`, turns off the serial port and updates, and uses `/srv/media`
and `/srv/storage`.

## Keys

### Names

| Key | Default | Meaning |
|---|---|---|
| `gameName` | `Game` | The name of the product, in the master's toolbar, its welcome and the page title. |
| `masterName` | `Master` | Follows `gameName` in the master's page title. |
| `screenName` | `Screen` | Not used. |
| `join.wifiName` | `BuzzerBoxNetwork` | The WiFi that the waiting screen and the start page tell people to join. It is built into the client, so it does **not** follow a `WIFI_SSID` changed in `buzzerbox.txt`. |
| `join.masterAddress` | `buzzer.box` | The address they tell people to open. |

### `server`: the WebSocket

| Key | Default | Meaning |
|---|---|---|
| `server.port` | `4201` | The port of the game server's WebSocket. |
| `server.address` | `""` | The host the client connects to. Empty means the host the page was loaded from, so a box's address or hostname can change without a new build. |
| `server.webSocketProtocol` | `ws` | The protocol of the WebSocket URL. |
| `server.retryIntervalInMS` | `500` | How long the client waits before it tries to connect again. |
| `reverseProxy` | `false` | The client then uses `/ws`, `/media` and `/storage` on the page's own origin instead of the ports, so a proxy's TLS and login cover them (the test environment's Caddy). |

### `fileServer` and `storage`: media and games

| Key | Default | Meaning |
|---|---|---|
| `fileServer.port` | `4202` | The port that serves the media and the storage API. |
| `fileServer.localPath` | `/media/pi` | Where USB sticks are mounted. Every folder in it is one stick. |
| `fileServer.publicPath` | `/media` | The URL path the media are served under. |
| `storage.boxPath` | `/var/lib/buzzerbox/storage` | The box's own storage; its games are in `games/` below it. |
| `storage.usbPath` | `""` | The folder whose folders are the sticks that can hold games. Empty means `fileServer.localPath`. |

### Buzzers of the box

| Key | Default | Meaning |
|---|---|---|
| `buzzers[]` | ten buzzers | The analog buzzers of the box, in the order of its ports. A team keeps its buzzer across server restarts by its position in this list. |
| `buzzers[].name` | `Buzzer 1` … | What the master calls it. |
| `buzzers[].key` | `Digit1` … | The key (`KeyboardEvent.code`) that presses it on a screen, if `enableBrowserKeypressEvents` is on. |
| `buzzers[].byte` | `31` … | The byte the microcontroller sends when it is pressed, written as its hex digits: `31` is `0x31`. |
| `buzzers[].color` | none | Optional, `#rrggbb`: the color of its team on the screens. Without it, teams get colors by position. |
| `softReleaseKey` | `KeyQ` | The key that stands for the box's release button. |
| `softReleaseByte` | `71` | The byte of the box's release button, written like `buzzers[].byte`. |
| `enableBrowserKeypressEvents` | `false` | Whether screens send key presses as buzzers and the server takes them. For development and the test environment. |
| `boxSettingsFile` | `/etc/buzzerbox/box.conf` | The settings of this box that `buzzerbox-apply-settings` writes, read once when the server starts. Today it holds `ANALOG_BUZZERS`; with `no`, the server offers none of `buzzers[]` and leaves the serial port alone. A missing file means the defaults. |

### `serial`: the box's microcontroller

| Key | Default | Meaning |
|---|---|---|
| `serial.enabled` | `true` | Whether the server opens the serial port at all. |
| `serial.address` | `/dev/ttyS0` | The port, the GPIO UART on a box. |
| `serial.baudRate` | `115200` | |
| `serial.commands.softRelease` | `1` | The command that releases the box's lock. |
| `serial.commands.setBuzzer` | `2` | The command that lights up one buzzer; its parameter is the buzzer. |
| `serial.stuffingBit` | `0` | The second byte of a command without a parameter. |
| `serial.eol` | `255` | The byte that ends every command. |
| `serial.heartbeatIntervalInMS` | `2000` | How often the server sends a heartbeat, so the box shows that the Pi is connected. |
| `i2c.*` | | Not used. Left from when the microcontroller was read over I2C. |

A command to the microcontroller is three bytes: `[command, parameter or stuffingBit, eol]`.

### `udpBuzzer`: wireless buzzers

| Key | Default | Meaning |
|---|---|---|
| `udpBuzzer.enabled` | `true` | Whether the server listens for wireless buzzers. |
| `udpBuzzer.listenPort` | `5005` | The UDP port they send to. |
| `udpBuzzer.heartbeatTimeoutInMS` | `5000` | A buzzer that sent nothing for this long is shown as offline. It stays in the list. |
| `udpBuzzer.pressCollectionWindowInMS` | `50` | Presses that arrive within this time are compared by their time stamps, and the earliest wins. |
| `udpBuzzer.batteryLowInMV` | `3500` | Below this battery voltage, a buzzer is shown with a low battery. |
| `udpBuzzer.provisioning.enabled` | `true` | Whether buzzers plugged into the box over USB can be adopted. |
| `udpBuzzer.provisioning.settingsFile` | `/etc/buzzerbox/wireless-buzzers.conf` | The WiFi name, passphrase and server address a buzzer is given (`KEY=value`), written by `buzzerbox-apply-settings`. |
| `udpBuzzer.provisioning.usbIds` | `1a86:55d4`, `239a:8113`, `239a:811b` | The USB IDs (`vendor:product`) of serial ports that are buzzers: the Feather V2's CH9102 and the Feather ESP32-S3. |
| `udpBuzzer.provisioning.wakeUsbIds` | `1a86:55d4` | Those of them whose buzzer may be asleep while plugged in and is woken by a reset. |

### `update`: USB updates

| Key | Default | Meaning |
|---|---|---|
| `update.enabled` | `true` | Whether the server looks for update bundles and the master offers them. |
| `update.bundleDirectory` | `""` | The folder whose folders are searched: bundles are in `<folder>/<stick>/updates/`. Empty means `fileServer.localPath`. |
| `update.command` | `sudo -n /usr/local/sbin/buzzerbox-update start` | The command that installs a bundle; the server appends the bundle. |
| `update.statusFile` | `/var/lib/buzzerbox/update-status.json` | Where the update helper reports, which the server reads again after its restart. |
| `update.publicKeyFile` | `/etc/buzzerbox/update-public-key.pem` | The key that bundles' signatures are checked with. |
