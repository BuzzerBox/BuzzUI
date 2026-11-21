# Development setup

How to run the BuzzerBox software on your own computer, without a box.

## What you need

- Node.js 18 or later (the boxes run Node.js 24) and npm
- Chrome, for the client's tests
- `socat`, only if you want the virtual serial port for the box's analog buzzers

The repository has three TypeScript parts that are **not linked at build level**: `server/` and `client/` are npm
projects of their own, and both import `shared/` and `config.json` by relative path.

## First start

```sh
cp config.dev.json.example config.dev.json
```

`config.dev.json` is not in git, but the server and the client both import it, so **neither builds without it**. It
holds what differs on your computer from a box, see the [configuration reference](configuration.md#layers).

**Server**, in `server/`:

```sh
npm install
npm run startDev
```

`startDev` opens the virtual serial port (which needs `socat`), compiles the server to `server/dist/` and runs it in
dev mode. Without `socat`, run `npm run transpile && npm start -- --dev=1` instead: everything works but the analog
buzzers over serial.

Because `shared/` and `config.json` are compiled in, the entry point is `server/dist/server/main.js`. Both config
files are compiled into `dist/` as well, so **after changing one, run `npm run transpile` again** before you restart
the server.

**Client**, in `client/`:

```sh
npm install
npm start
```

This serves the app at http://localhost:4200 and reloads it when a file changes. Open `/master` in one window and
`/screen` in another, or pick the role on the start page.

| Command (in `client/`) | What it does |
|---|---|
| `npm start` | `ng serve` on port 4200 |
| `npm run build` | The production build, to `client/dist/client` |
| `npm run buildDev` | A development build |
| `npm test` | The specs, in Chrome |
| `npm run lint` | angular-eslint |

## Buzzers without a box

**In the browser.** In dev mode (`enableBrowserKeypressEvents`), a screen takes key presses as buzzers: the keys `1`
to `9` and `0` are the ten buzzers of `config.json`, and `Q` is the release button of the box. The window with the
screen needs the focus. The start page also offers the *Virtual dev board*, which has a button for each buzzer.

**Over the virtual serial port.** `scripts/open_serial.sh` links `/tmp/ttyV0`, which the server reads in dev mode, to
`/tmp/ttyV1`. `scripts/send_serial.sh` is a menu that writes the bytes of the buzzers and of the release button to
`/tmp/ttyV1`, like the box's microcontroller does.

**Wireless buzzers over UDP.** A wireless buzzer isn't configured anywhere: it shows up when it sends heartbeats to
port 5005. To simulate one, send its packets with `nc`:

```sh
# a buzzer with the MAC address AA:BB:CC:DD:EE:01 reports in; repeat it at least every 5 s to keep it online
echo '{"t":"HB","id":"AA:BB:CC:DD:EE:01","seq":1,"bat":3900,"fw":"1.3.0","col":"#1e88e5"}' | nc -u -w1 localhost 5005
# it is pressed
echo '{"t":"PRESS","id":"AA:BB:CC:DD:EE:01","n":1,"ts":0}' | nc -u -w1 localhost 5005
```

Each press needs a new `n`, since the server takes every `n` only once per buzzer. The
[architecture](architecture.md#wireless-buzzers-udp) describes the packets.

**Adopting a real wireless buzzer.** To give a buzzer on your desk your own WiFi instead of a box's, point
`udpBuzzer.provisioning.settingsFile` in `config.dev.json` at a file like this (`wireless-buzzers.dev.conf` is ignored
by git for this purpose), with your computer's address in that network:

```
WIFI_SSID=YourWiFi
WIFI_PASSPHRASE=its password
SERVER_IP_ADDRESS=192.168.1.23
```

## Games and media

In dev mode, the box's own games are in `server/box-storage/`, and `server/media/` stands for the place where the box
mounts USB sticks: **each folder in it is one stick**. Both are ignored by git.

```
server/media/DevStick/             a stick named "DevStick"
  buzzerbox-games/                 its games
  Audio/, Images/, …               its other media, which can be copied into a game
  updates/                         update bundles, which the master offers to install
```

`deploy/test/example-game/Beispielspiel.json` is a small game that you can upload under *Manage games*.

## Tests and lint

There are no server tests. The client's specs run with Karma and Jasmine:

```sh
npm test                                                                  # all, watching, in a Chrome window
npx ng test --watch=false --browsers=ChromeHeadless                      # once, without a window
npx ng test --include src/app/services/game.service.spec.ts              # one spec
```

**Neither the specs nor the linter are clean on `main`**, so compare with `main` instead of expecting a green run:

- Six older specs fail: "should create" of `AnswerOptionsComponent`, `MediaQuestionComponent`,
  `MediaQuestionDisplayOrderConfigurationComponent` and `MediaRemoteComponent`, "should render title" of
  `AppComponent`, and "shows a refused master the page about the other master" of `GameService`.
- `npm run lint` reports about 200 errors, mostly `prefer-standalone` and `prefer-inject`. Compare the count before
  and after your change.

Two things to know when you write a spec:

- TestBed in Angular 21 is zoneless by default, but the app runs with zone.js. A spec of a component that updates
  itself from timers or subscriptions needs `provideZoneChangeDetection()` in its providers, or it fails with
  `ExpressionChangedAfterItHasBeenCheckedError`.
- `src/test.ts` gives every spec the app's texts in German, so a component can use the `transloco` pipe without
  importing anything, and texts can be checked as German.

## Texts and languages

Every text of the UI is in `client/src/i18n/de.json` and `en.json`. A new text needs a key in both; a spec checks
that they have the same keys and parameters. See [languages](architecture.md#languages) for how templates and code
use them.

## Wireless buzzer firmware

The firmware of the wireless buzzers is in [`firmware/wireless-buzzer/`](../firmware/wireless-buzzer/README.md). It
needs [PlatformIO](https://platformio.org/) and is built from that directory:

```sh
cd firmware/wireless-buzzer
pio run                    # build for the Feather V2 (-e feather_s3 for the Feather ESP32-S3)
pio run --target upload    # flash over USB
pio test -e native         # tests of lib/buzzer_core on this computer
```

Its version is `FIRMWARE_VERSION` in `include/config.h`, separate from the box's `version.json`. A change to the UDP or
USB protocol changes the firmware and the server (`UdpBuzzerService`, `BuzzerProvisioningService`) in the same PR.
To try a buzzer against a dev server, see [Buzzers without a box](#buzzers-without-a-box) and
`udpBuzzer.provisioning.settingsFile` in the [configuration](configuration.md).

## Building what runs on a box

- `scripts/create-installation-files.sh` builds the client and the server into `install/.assets/compilations/`.
- `scripts/create-update-bundle.sh` packs that into an update bundle, see [operations](operations.md#update-bundles).
- `provisioning/image/build.sh` builds the image of a box, see [provisioning](../provisioning/README.md).
