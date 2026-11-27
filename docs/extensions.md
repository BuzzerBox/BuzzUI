# Extensions

The server and the client can be extended without changing their core: an extension adds a kind of buzzer, pages,
cards, themes, box settings or texts. This repository holds the core and the extensions it builds with; a build with
other extensions keeps the core as it is and only lists different ones.

So far there is one extension, `serial-buzzers`: the analog buzzers of the BuzzerBox Classic, wired to the box and read
by its microcontroller on the serial port. It is still built in here (see [Plan](#plan)).

## Server

An extension implements `IServerExtension` (`server/extensions/server-extension.ts`): an `id` and `start(host)`.
`startServer(extensions)` in `server/app.ts` starts the server's services and then each extension, once; one that throws
while it starts is logged and left out. `server/main.ts` starts the server with `BUILT_IN_EXTENSIONS`
(`server/extensions/built-in-extensions.ts`); a build with other extensions has a `main.ts` of its own that calls
`startServer()` with its list.

An extension only talks to the game through the `IExtensionHost` it gets in `start()`:

| Method | What it does |
|---|---|
| `getBoxBuzzers()` | The buzzers of the box: those of `config.json`'s `buzzers`, in its order, with IDs that stay the same while the server runs |
| `enableBoxBuzzers()` | Offers the box's buzzers to the master. Without it, the master only offers them while browser keypresses are on (`enableBrowserKeypressEvents`, dev and the test environment). |
| `pressBuzzer(buzzerId)` | A buzzer was pressed. The first press that counts marks its team and locks the buzzers; presses while they are locked, and of buzzers without a team, don't count. |
| `releaseFromBox(extensionId)` | The release on the box (its button) released the buzzers, like the master's release |
| `onLockReleased(callback)` | Called whenever the buzzers are released, with the ID of the extension that released them (from `releaseFromBox`), or `undefined` for the master and the game (a new question, a wrong answer, a reset) |
| `getBoxSetting(key)` | A setting of `buzzerbox.txt` as the box applied it when the server started |
| `registerPacketHandler(type, handler, options)` | Handles the extension's own packets, see [Packets](#packets) |
| `sendToMaster(packet)`, `sendToAllScreens(packet)` | Sends packets |
| `isGameRunning()` | A game is set up and not over yet |
| `getActiveExtension()` | The extension whose [mode](#modes) is on, or `null` for the quiz |

`serial-buzzers` (`server/extensions/serial-buzzers/`) shows how they fit together: on a box with analog buzzers
(`ANALOG_BUZZERS` isn't `no`), it enables the box's buzzers and opens the serial port. A buzzer's byte from the
microcontroller becomes `pressBuzzer()` of the box's buzzer with that `byte` in `config.json`, and the release button's
byte becomes `releaseFromBox()`. On every other release it sends the microcontroller the `softRelease` command, since
the microcontroller locks the buzzers in hardware.

## Packets

The core's packet types are `EPacketTypes`, numbered from 0. An extension numbers its own from
`PacketTypeHelper.FIRST_EXTENSION_PACKET_TYPE` (1000), so the core can add types without clashing with them; it picks a
range of its own and keeps its numbers, like the core. Its packets are `IGamePacket`s with such a `packetType`.

The server hands a packet of a registered type to its handler, with whether the master sent it. Like the core's
packets, it only takes them from the master, unless the handler was registered with `isFromAnyConnection`. A packet of
a type that no extension registered is ignored. The client sends and receives them like any other packet.

## Data in games

`IGameDefinition.ext` (a version of a game) and `IGameState.ext` (the progress of a game, which its saved state holds)
are for extensions: objects by extension ID, e.g. `{"serial-buzzers": {…}}`. The core keeps them as they are: the
editor saves a version's `ext` again when it saves a new version, the server stores and imports it, and the state is
saved as a whole.

## Box settings

An extension's settings of `buzzerbox.txt` are `IBoxSettingDefinition`s (key, default, valid values and the setting
they follow), registered with `BoxSettingsHelper.register()` on the server (in `start()`) and on the client (through
`boxSettings`, see below). The definition lives in `shared/`, so both register the same one; e.g.
`shared/extensions/serial-buzzers/analog-buzzers.setting.ts`.

The box's own scripts apply and write `buzzerbox.txt` (`buzzerbox-apply-settings`, `buzzerbox-settings.sh`) and must
know the setting as well; see [box settings](box-settings.md). For now they still know `ANALOG_BUZZERS` themselves.

## Client

An extension's client part is an `IClientExtension` (`client/src/app/extensions/client-extension.ts`), listed in
`CLIENT_EXTENSIONS` in `client/src/app/extensions/extensions.ts`. A build with other extensions replaces that file with
its own list through `fileReplacements` in its `angular.json`; the file must export `CLIENT_EXTENSIONS` and
`registerClientExtensions()`.

| Part | Where it shows |
|---|---|
| `masterRoutes` | Pages under `/master/`, after the core's, while no game is set up and no [mode](#modes) is on; like those, they should use `RouteGuard` |
| `mode` | A [mode](#modes) that takes over the master and the screens, with its button on the home page |
| `publicRoutes` | Pages outside `/master/` and `/screen/`, e.g. for guests on the box's WiFi; their paths should start with the extension's ID. The box's touch display doesn't show them (`touchDisplayGuard`). |
| `homeCards` | Standalone components, shown as cards on the master's home page after the core's |
| `screenThemes` | Looks for the screens, after the core's (see [screen themes](architecture.md#screen-themes)); their CSS variables come with the extension's styles |
| `boxSettings` | Settings of `buzzerbox.txt`, registered in `BoxSettingsHelper` |
| `boxSettingGroups` | Groups of settings on the master's settings page, each after the group named in `after` |
| `translations` | Texts by language, merged into the app's. An extension keeps its own under `ext.<id>.` so they never clash with the core's. |

`registerClientExtensions()` registers the box settings and merges the texts; `main.ts` calls it before the app starts,
and `test.ts` before the specs run.

## Modes

An extension can take over the box's master and screens for something other than the quiz, e.g. another game on the
same TV: its `mode` (`IClientExtensionMode`) has a button on the master's home page (`icon`, `titleKey`, `textKey`) and
pages of its own for the master (`masterRoutes`, under `/master/`) and for the screens (`screenRoutes`, under
`/screen/`). The first route of each, which must not have parameters, is where they go when the mode is switched on.

- The button calls `GameService.setActiveExtension(id)`, which sends `SET_ACTIVE_EXTENSION`. The server takes it only
  from the master, only while no game is set up, and only for an extension it started, so an extension with a mode
  needs a server part, even one whose `start()` does nothing. It keeps the mode and sends it to the master and to every
  screen, and also to each one when it registers, so a reloaded screen and a master that rejoins show the mode's pages
  again.
- While a mode is on, the route guards only let the master and the screens open its pages, and the server refuses to
  set up a game. The core puts its guards in front of the mode's routes itself.
- The mode's own pages switch it off again with `GameService.setActiveExtension(null)`; the master then shows its home
  page, and the screens the quiz's.
- A mode that this build of the client doesn't know shows the quiz's pages.

What happens on the mode's pages is up to the extension, e.g. talking to a server of its own through the box's web
server.

## Plan

The analog buzzers are only on the BuzzerBox Classic, so they leave this repository in three steps:

1. The extension points, with `serial-buzzers` moved behind them, still built in (this state).
2. The build for the BuzzerBox Classic takes this repository as its core, with `serial-buzzers` as one of its
   extensions, its own update bundles and its own box image.
3. `serial-buzzers`, `ANALOG_BUZZERS` and its texts leave this repository, once the Classic boxes can install that
   build's updates.
