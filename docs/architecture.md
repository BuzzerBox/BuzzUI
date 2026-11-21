# Architecture

How the parts of the BuzzerBox software fit together. For setting it up on your computer, see the
[development setup](development.md).

```
 phone/tablet/notebook            the box (Raspberry Pi)                             TV on HDMI
┌──────────────────┐   WebSocket ┌──────────────────────────────────────┐ WebSocket ┌──────────────┐
│ client: /master  │◄───4201────►│ server/ (Node.js)                    │◄────────►│ client:      │
│ (Angular)        │   HTTP 4202 │  GameService – the game automaton     │          │ /screen      │
│                  │◄───────────►│  FileServer + StorageApi (media,games)│ HTTP 4202│ (Chromium    │
└──────────────────┘             │  SerialPortService ◄── UART ── µC ◄── analog buzzers  kiosk)   │
                                 │  UdpBuzzerService ◄── UDP 5005 ── wireless buzzers  └──────────────┘
                                 │  BuzzerProvisioningService ◄── USB ── a wireless buzzer to adopt
                                 └──────────────────────────────────────┘
                                   nginx serves the built client on port 80
```

- **`server/`** is the only source of truth for the game. All its services are singletons, reached with `X.get()`.
- **`client/`** is one Angular app with two lazy-loaded feature modules: `master/` (the host's pages) and `screen/`
  (the display; Chromium on the box opens `/screen/`). `/choose` lets a device pick its role. The client's
  `services/game.service.ts` holds the state and handles the packets for both roles (`useAsMaster()` /
  `useAsScreen()`).
- **`shared/`** has the packet types, enums and helpers both import through `shared/shared.ts`. Nothing links the
  three at build level; they import each other by relative path.

## Packets

Everything between the server and the clients goes over **one WebSocket per client**, carrying JSON packets
`{packetType: EPacketTypes, …}`. `shared/enums/EPacketTypes.ts` lists the types; each has an interface `I…Packet` in
`shared/interfaces/`. Requests that need an answer get a `RESPONSE_PACKET` (`IResponsePacket`) with the type it
answers and whether it worked.

**Who may send what.** The server takes `REGISTER_MASTER`, `REGISTER_SCREEN`, `KEYPRESS_ON_SCREEN` and
`UPDATE_MEDIA_STATE` (a screen reports that its medium ended) from any connection. **Every other packet is only taken
from the master's connection** and ignored with a warning from others. There is one master and any number of screens.

**Adding a packet:**

1. Append a value at the **end** of `EPacketTypes`. The values are numbers, so inserting one would renumber the others
   and break a master and server of different versions.
2. Add its interface in `shared/interfaces/` and export it from `shared/interfaces.ts` (and a new enum from
   `shared/enums.ts`).
3. Handle it in `onPacket` of `server/services/game.service.ts`. A packet only the master may send goes below the
   `con !== this.webSocketConnectionMaster` check.
4. Handle it in the `switch` of the client's `GameService`.

**Keeping connections alive.** The server pings every connection every 10 s and drops those that don't answer, so a
master whose device left the WiFi doesn't block a new one. The client's `WebSocketService` reconnects whenever the
connection is lost and queues what is sent meanwhile. The server forgets a client with its connection, so after a
reconnect `GameService.onReconnected()` registers again: screens reload, a master in the setup registers again
(keeping its form), and a master in a game reloads and rejoins it.

## Game states

`GameService` on the server moves through `EGameStates`:

```
WAITING_FOR_MASTER → WAITING_FOR_SETUP → WAITING_FOR_START → PLAYING → END
                                                ↕
                                           LOST_MASTER
```

| From | Event | To |
|---|---|---|
| `WAITING_FOR_MASTER` | a master registers | `WAITING_FOR_SETUP` |
| `WAITING_FOR_SETUP` | `SETUP_GAME` | `WAITING_FOR_START` |
| `WAITING_FOR_SETUP` | the master disconnects | `WAITING_FOR_MASTER` |
| `WAITING_FOR_START` | `START_GAME` | `PLAYING` |
| `WAITING_FOR_START`, `PLAYING` | the master disconnects | `LOST_MASTER` |
| `LOST_MASTER` | the master comes back, or another device takes over | `WAITING_FOR_START` (and `START_GAME` again) |
| `PLAYING` | `END_GAME` | `END` |
| `END` | the master disconnects | `WAITING_FOR_MASTER`, and the screens reload |
| any state with a game | `RESET_SERVER` | `WAITING_FOR_SETUP` |

- **Setup.** In `WAITING_FOR_SETUP`, the server sends the master `PRESETUP_AVAILABLE_INFO` (the buzzers it can use).
  The master sets up a game with `SETUP_GAME` (`ISetupPacket`: teams, questions, the `IGameStorageRef` to save to, the
  screen theme). As soon as the server confirms it, the client sends `START_GAME` by itself; there is no separate start
  page.
- **Playing.** `SET_QUESTION`, `ANSWER_SET_STATE`, `GRADE_ANSWER`, `TEAM_SET_POINTS`, `MARK_TEAM`, `SET_BUZZER_LOCK`,
  `UPDATE_TEAMS`, `UPDATE_MEDIA_STATE` and `SET_MEDIA_VOLUME` change it. A new game starts with a welcome screen
  (`IGameState.welcome`) with the buzzers locked, until the master goes to the first question.
- **Losing the master.** If the master's connection closes during a game, the server goes to `LOST_MASTER` and keeps
  the game. When that device comes back (it sends the same `masterId`, kept across reloads), it gets
  `NEW_MASTER_ACCEPTED` with the teams, questions and `IGameState`, and the game goes on. Another device can only
  join as master with `takeOver`; the server then sends the old master `MASTER_TAKEN_OVER` and closes its connection.
  This also works while the old master is still connected. Without `takeOver`, a second master is refused.
- **Ending.** `END_GAME` shows the end screen. `RESET_SERVER` (pause, discard, or *Reset server* on the home page)
  goes back to `WAITING_FOR_SETUP`; with `discardState`, the autosave deletes the state instead of keeping it.
- `WAITING_FOR_ACTION` is in the enum but not used.

**What the screens get.** The server pushes `DATA_FOR_SCREEN` packets with the teams, the question and `IGameState`:
the question number, the marked teams, the buzzer lock, the logged and revealed answers, the media state and volume,
the theme. Both sides keep `IGameState` up to date with `shared/helper/game-state.helper.ts`, so a screen that reloads
or a master that rejoins shows the same thing.

## Buzzing and grading

The server maps every input (below) to a team's buzzer and handles the lock itself:

1. A buzz from an unlocked buzzer that has a team **marks** that team and **locks** the buzzers.
2. The master grades the answer (`GRADE_ANSWER`, `EGradeResults`): correct, wrong or double. The points come from
   the question's `points` and the game's scoring (`shared/helper/scoring.helper.ts`): a correct answer adds them, a
   double one adds twice or one more, a wrong one subtracts the points, one point or nothing. Scores can go below zero.
3. A correct or double answer reveals the correct answers and keeps the lock. A wrong one unmarks the team and
   releases the lock for the others.
4. Releasing from the master (`SET_BUZZER_LOCK` with `setLock: false`) also unmarks the team, like the release button
   on the box (the *soft release*).

## Buzzer input

### The box's analog buzzers (serial)

A microcontroller in the box reads the wired buzzers and talks to the Pi over the GPIO UART (`/dev/ttyS0`, 115200
baud). Its firmware is in the [BuzzController](https://github.com/BuzzerBox/BuzzController) repository.

- **Microcontroller → Pi:** one byte per event: the buzzer's `byte` from `config.json` (`0x31`… for buzzers 1…), or
  `softReleaseByte` (`0x71`) for the release button.
- **Pi → microcontroller** (`MicroControllerSerialAdapter`): frames of three bytes `[command, parameter or
  stuffingBit, eol]`: `setBuzzer` (2) with the buzzer to light up, `softRelease` (1) to release the lock.
- **Heartbeat:** the server sends a lone `eol` byte (255) every `serial.heartbeatIntervalInMS`. If none arrives for 6 s,
  the box shows a lost connection (the dot of its 7-segment display).

`ANALOG_BUZZERS=no` in `buzzerbox.txt` turns all of this off (through `/etc/buzzerbox/box.conf`, read by
`BoxSettingsService`): the server then offers none of the box's buzzers and leaves the port alone.

### Wireless buzzers (UDP)

ESP32 buzzers (Adafruit Feather V2 or Feather ESP32-S3) join the box's WiFi and send JSON packets to UDP port 5005
(`UdpBuzzerService`). They aren't configured anywhere: a buzzer appears when it sends heartbeats. Their firmware is in
[`firmware/wireless-buzzer/`](../firmware/wireless-buzzer/README.md), whose README documents the protocol from the
buzzer's side; **change both sides together**, in the same PR.

| Packet | Direction | Fields |
|---|---|---|
| `HB` | buzzer → box, every second | `id` (MAC), `lp` (its port), `seq`, `bat` (mV), `fw`, `col` (case color), `pct` (battery %, firmware 1.3.0 on an S3), and diagnostics `rr`, `up`, `wd`, `wr` |
| `PRESS` | buzzer → box | `id`, `n` (counts presses), `ts` (when, on the box's clock, in µs) |
| `STATE` | box → buzzer | `selected` (its team is marked), `locked`, `game` (a game is running), `st` (the box's clock in µs), `ack` (answers a heartbeat's `seq`), `pa` (answers a press's `n`) |

- The box answers every heartbeat and every press with a `STATE`, and sends one to all buzzers whenever the lock, the
  marked team or the game state changes. `game` keeps battery-powered buzzers awake during a game.
- `st` is `process.hrtime` since the server started. The buzzers follow it, so that `ts` is on the box's clock.
- A buzzer repeats a press until a `STATE` with its `pa` arrives, so the server takes each `n` once per buzzer.
- Presses that arrive within `pressCollectionWindowInMS` (50 ms) are compared by `ts` (0 means the first to arrive
  wins), and the earliest one whose buzzer has a team wins.
- A buzzer's ID is `udp:<MAC>` (`BuzzerHelper`). One that sends nothing for `heartbeatTimeoutInMS` is shown as offline
  but stays in the list, so the list only grows and each buzzer keeps its `buzzerIndex` while the server runs.
- The master gets the whole list in `AVAILABLE_BUZZERS` whenever it changes, also when a battery gets low
  (`batteryLowInMV`, with 100 mV of hysteresis).

**Colors and names.** A buzzer's case color (`BuzzerHelper.CASE_COLORS`) is stored on the buzzer and reported in
every heartbeat (`col`), so it becomes `IBuzzer.color`. The server copies it onto the team (`ITeam.color`), and the
screens' `TeamColorHelper` prefers it over the palette by position. The master does the same with its own teams when it
sets up a game (`GameService.setGameData`), since the server only sends them back when a buzzer's color changes. The client names wireless buzzers in the master's
language (`BuzzerNameHelper`): after the color ("Blauer Wireless Buzzer", with the end of the MAC if two share one),
or "Funkbuzzer" and the end of the MAC. A new team on a colored buzzer is named after the color ("Blau", "Blau 2",
`TeamHelper.makeDefaultName`), one on another buzzer "Team <n>", skipping names the other teams have. Teams that play
need distinct names (compared ignoring case and surrounding spaces): `TeamHelper.distinctNamesValidator` on the team
forms of `prepare-game` and `dialog-teams` blocks starting or applying while two have the same name.

### Adopting wireless buzzers over USB

A buzzer gets the box's WiFi when it is plugged into the box by USB and the master adopts it
(`BuzzerProvisioningService`). The server polls the serial ports every 2 s for `udpBuzzer.provisioning.usbIds` and
talks to a new one in text lines at 115200 baud:

```
box → buzzer:  BUZZ HELLO
buzzer → box:  BUZZ READY <mac> <firmware> {"ssid":…,"host":…,"port":…,"color":…}
box → buzzer:  BUZZ WIFI {"ssid":…,"pass":…,"host":…,"port":…,"color":…}      only when the master adopts it
buzzer → box:  BUZZ OK  |  BUZZ ERROR <reason>
```

- The JSON after `BUZZ READY` (firmware 1.1.0 and later) tells the WiFi the buzzer has, never its passphrase. If it is
  the box's, the master shows the buzzer as adopted already.
- A sleeping Feather V2 doesn't answer. After 2 s, a buzzer on one of `wakeUsbIds` is reset through RTS, which wakes
  it. The reset is done by a small `python3` ioctl helper, since serialport's `set()` fails on the CH9102 under Linux.
  A Feather ESP32-S3 can't be woken over USB, but stays awake while it is plugged into a host, and is never reset.
- The master gets the plugged-in buzzers in `USB_BUZZERS` (`IUsbBuzzer`: identifying → detected / no answer →
  adopting → adopted / failed) and adopts one with `ADOPT_USB_BUZZER` (with a case color). Only then does the server
  send the WiFi name, passphrase and its address, from `udpBuzzer.provisioning.settingsFile`.
- The master's home page shows one list (`master/wireless-buzzers`) that merges the USB buzzers with the online UDP
  buzzers by MAC.

### Browser keys

With `enableBrowserKeypressEvents` (dev and test only), a screen sends key presses as `KEYPRESS_ON_SCREEN`. Both the
screen and the server check the setting.

## Games and storage

A game is a folder with immutable versions, states and media, on the box (`storage.boxPath`) or on a USB stick
(`buzzerbox-games/` on every folder of `storage.usbPath`). The [game file format](game-file-format.md) describes the
files.

- `StorageService` implements the storage; `StorageApiService` serves it as a REST API under `/storage` on the file
  server's port. The routes are listed in `shared/helper/storage-api.helper.ts`.
- **Every request needs a token** (header `X-BuzzerBox-Token`), which the master gets in `STORAGE_ACCESS` when it
  registers, and which is revoked when it leaves. Downloading an archive, which the browser does without the header,
  takes a one-time ticket instead.
- **Autosave.** `SETUP_GAME` names the state to play (`IGameStorageRef`). `AutosaveService` writes it one second after
  the last change, and retries if the stick was pulled out. It reports to the master in `AUTOSAVE_INFO`, which the
  toolbar shows. Pausing keeps the state, discarding deletes it.
- **Clock.** The box has no battery-backed clock and no internet. `ClockService` takes the master's time from
  `REGISTER_MASTER` for the timestamps it saves.

On the client, `setup` is the editor (questions only, it saves versions), `prepare-game` chooses the teams and the
theme and creates or continues a state, and `game-list`, `media-browser`, `game-import` and `storage-manager` handle
the rest. `MediaHelper.applyMediaDefaults` fills in how media questions start, and
`StorageService.resolveMediaUrls` turns the relative media paths into URLs before `SETUP_GAME`.

## Media

`FileServerService` serves the USB sticks (`fileServer.localPath`, `/media/pi` on the box) under `/media`, and the
box's own games under `/media/BuzzerBox`. **Only files with a media extension are served**
(`shared/services/file-extensions.service.ts`), so versions and states, which hold the answers, can't be read there.
A GET on `/media` returns a tree of the sticks.

| Kind | Extensions |
|---|---|
| Images | `.png .jpg .jpeg .gif .bmp .webp .avif` |
| Video | `.mp4 .m4v .webm` |
| Audio | `.mp3 .wav .ogg .m4a` |

Video and audio are handled alike ("playable"). Every screen plays the medium itself, with
`@videogular/ngx-videogular`. The master controls it with `UPDATE_MEDIA_STATE` (play, pause, reset, fullscreen, the
slide of a slideshow) and `SET_MEDIA_VOLUME`; the server stores both in `IGameState` and forwards them to all screens
and the master. A screen whose medium ended reports `FINISHED`, which can show the question or answers that wait for
it (`EQuestionAnswerStates.WAIT_FOR_MEDIA`).

## Screen themes

The look of the screens is chosen per game when it is prepared, and travels as `IGameState.themeId` (also in
`ISetupPacket.themeId`), so it is saved with the state and reaches screens that connect later.

- `client/src/app/themes/screen-themes.ts` is the registry: `studio` (dark, the default), `daylight` (light) and
  `classic` (the look from before themes). A missing or unknown ID means the default.
- `ScreenThemeHelper` resolves a theme and sets `<html data-screen-theme="…">`.
- `classic` uses the screen components' original `:host(.screen)` CSS.
- The others are *show* themes: rules under `:host(.screen.show)`, with colors and fonts from `--bb-*` variables in
  `themes/themes.scss`. They add team colors, the buzz banner, grade flashes and counting points, a crown, A–D answer
  badges, a progress bar, the branded waiting screen and the podium.
- **A new show theme** only needs a registry entry and a block of variables.
- The master stays light in every theme. Before a game, a screen uses the theme of its last game (`localStorage`).
- The fonts (Rubik and Material Icons) are bundled through `angular.json`, since the box has no internet; don't load
  fonts from Google. The build puts them in `fonts/`, not `media/`, because a reverse proxy sends `/media*` to the file
  server.

## Languages

The UI is in English (the default, until the master chooses a language) and German.

- The texts are in `client/src/i18n/de.json` and `en.json`: nested keys, `{{parameters}}`, and `.one`/`.other` pairs for
  texts with a number. `i18n.spec.ts` checks that both have the same keys and parameters. They are bundled, not
  fetched, so the box shows them right away.
- Templates use Transloco's pipe (`{{'common.cancel' | transloco}}`, with `TranslocoModule` imported). Code uses `t()` and
  `tn()` of `app/i18n/i18n.ts`, which need no injection, so helpers can use them.
- **Keep the key, not the translated text**, in fields and state, and translate where it is shown, so it follows a
  change of the language.
- `LanguageService` holds the language and remembers it in `localStorage`. The master chooses it (on `/choose` and in
  its toolbar), and `GameService.setLanguage()` sends `SET_LANGUAGE`, also on every registration. The server keeps it
  and passes it on to every screen, also to one that connects later.
- The server's own messages (storage and update errors) are only in English.
- **A new language** needs its file, an entry in `LanguageHelper.LANGUAGES` (`shared/`), `TRANSLATIONS` and
  `LANGUAGE_NAMES` in `i18n.ts`, and a locale in `FormatHelper`.

## Updates

The server looks for update bundles on the sticks while no game is set up (`UpdateService`), tells the master in
`UPDATE_INFO`, and installs one on `INSTALL_UPDATE` through the root helper `buzzerbox-update`. See
[operations](operations.md#update-bundles).
