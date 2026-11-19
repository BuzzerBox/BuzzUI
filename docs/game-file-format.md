# Game file format

How games are stored on a box and on USB sticks, and what the files that hosts download and import look like. The
types are in `shared/interfaces/IGameDefinition.ts`; the server's side is `server/services/storage.service.ts`, the
REST API over it is listed in `shared/helper/storage-api.helper.ts`.

## A game is a folder

```
games/<game>/                      on the box: <storage.boxPath>/games (default /var/lib/buzzerbox/storage/games)
  versions/1.json, 2.json, …       on a USB stick: <stick>/buzzerbox-games/<game>/
  versions/numbering.json
  states/<state>.json
  media/…
```

The folder name is the game's name. Names (of games, states, media files and folders) must not be empty, start with
`.`, be longer than 200 characters, or contain `\ / : * ? " < > | # %` or control characters, since FAT sticks and
URLs don't allow them (`StorageApiHelper.isValidName`).

| Part | What it is |
|---|---|
| `versions/<n>.json` | One version of the questions (`IGameDefinition`). Saving in the editor adds a new version if anything changed, and **a version is never changed afterwards**. A version that a state plays can't be deleted. |
| `versions/numbering.json` | `{"highestVersion": n}`: the highest number ever given, so a deleted version's number isn't given again to other questions. |
| `states/<state>.json` | One time the game is played (`IGameInstanceState`): teams, points and progress, pinned to the version it was started with. The server writes it while the game runs (see autosave in the [architecture](architecture.md#games-and-storage)). |
| `media/` | The game's images, videos and audio. Questions refer to them by paths **relative to this folder**, with `/` between folders, so the whole folder can be copied between the box and a stick. Media that a version shows can't be deleted, renamed or moved. |

Every JSON file is written atomically (a temporary file, then a rename) and is at most 20 MB.

## Version: `IGameDefinition`

```json
{
  "formatVersion": 4,
  "kind": "game",
  "version": 2,
  "savedAt": "2026-11-14T19:03:11.000Z",
  "questions": [
    {
      "text": "Which planet is this?",
      "points": 2,
      "notes": "Only the master sees this",
      "show": true,
      "answers": [
        {"text": "Mars", "isCorrect": true},
        {"text": "Venus", "isCorrect": false}
      ],
      "mediaDetails": {"fileSrc": "Space/mars.jpg"}
    }
  ],
  "mediaDefaults": {
    "image": {"mediaState": 1, "questionState": 1, "answerState": 0}
  },
  "scoring": {"doubleAnswer": "none", "wrongAnswer": "none"}
}
```

| Field | Meaning |
|---|---|
| `version` | Its number, set by the server when it stores it. |
| `savedAt` | ISO date, from the server's `ClockService` (the master's clock, since the box has none). |
| `questions[].text`, `answers[]` | The question and its answers; any number of answers may be correct. |
| `questions[].points` | What a correct answer is worth. Missing means 1. |
| `questions[].notes` | Notes for the host, like presenter notes. They are never sent to the screens. |
| `questions[].show` | Kept for old files; the client sets it. |
| `questions[].mediaDetails.fileSrc` | The medium, relative to `media/`. For a slideshow, the folder its images come from. |
| `questions[].mediaDetails.slides` | Only for a slideshow: its images, in order. |
| `questions[].initialConfig` | How this question starts (`IMediaQuestionState`, see below), overriding `mediaDefaults`. |
| `mediaDefaults` | How media questions start, by media kind: `image`, `playable` (video and audio) or `slideshow`. |
| `scoring.doubleAnswer` | `none` (no "double" grade), `plusOne` (points + 1) or `double` (twice the points). |
| `scoring.wrongAnswer` | `questionPoints` (minus the question's points), `one` (minus 1) or `none`. |

A game created in the editor starts with `{"doubleAnswer": "none", "wrongAnswer": "none"}`. A missing `scoring` or a
missing setting means the scoring from before it could be chosen: `double` and `questionPoints`
(`ScoringHelper.complete`). A version with unknown scoring settings is refused.

`IMediaQuestionState` uses the numeric enums of `shared/enums/`:

| Field | Values |
|---|---|
| `mediaState` | `EMediaStates`: 0 no media, 1 hidden, 2 playing, 3 paused, 4 reset, 5 finished |
| `questionState`, `answerState` | `EQuestionAnswerStates`: 0 hidden, 1 shown, 2 wait for the medium to end (only video, audio and slideshows) |
| `fullscreen` | Whether the medium fills the screen |
| `slideIndex` | Slideshows only: the image shown, from 0 |

## State: `IGameInstanceState`

```json
{
  "formatVersion": 4,
  "kind": "state",
  "gameVersion": 2,
  "createdAt": "2026-11-14T19:10:00.000Z",
  "updatedAt": "2026-11-14T20:41:27.000Z",
  "finished": false,
  "teams": [
    {"teamId": "…", "name": "Blau", "points": 7, "buzzerId": "udp:AA:BB:CC:DD:EE:01", "buzzerIndex": 10, "color": "#1e88e5"}
  ],
  "gameState": {
    "currentQuestionNumber": 4,
    "markedTeamIds": [],
    "loggedAnswers": [],
    "activatedAnswers": [],
    "setBuzzerLock": false,
    "mediaQuestionState": {"mediaState": 0, "questionState": 1, "answerState": 0},
    "mediaVolume": {"volume": 1, "muted": false},
    "themeId": "studio",
    "scoring": {"doubleAnswer": "none", "wrongAnswer": "none"},
    "welcome": false,
    "gameName": "Pub quiz"
  }
}
```

- `teams[].buzzerId` is `udp:<MAC>` for a wireless buzzer. The IDs of the box's own buzzers are generated anew on
  every server start, so a continued state finds those teams by `buzzerIndex`, their position in `config.json`'s
  `buzzers`, and the wireless ones by their ID.
- `teams[].color` is the case color of the team's wireless buzzer, if it has one.
- `gameState` is `IGameState` (`shared/interfaces/IGameState.ts`), the same object the server sends to screens. Fields
  that are missing in older states mean: `activatedAnswers` none, `themeId` the default theme, `scoring` the old
  scoring, `welcome` no welcome screen.

## Files on a device

Hosts can take games off the box in two ways, both under *Manage games*:

| File | Content | Made by |
|---|---|---|
| `<game>.buzzerbox.tar.gz` | The whole folder: `versions/`, `states/` and `media/` | The server (`createGameArchive`); the browser downloads it with a one-time ticket, since a download can't send the token header |
| `<game>.json` | An `IGameBundle`: one version, optionally one state, **no media** | The client (`GameFileHelper.makeBundle`) |

```json
{"formatVersion": 4, "kind": "bundle", "gameName": "Pub quiz", "game": { "…an IGameDefinition…": "" },
 "state": { "…an IGameInstanceState, optional…": "" }, "stateName": "Spiel 2026-11-14 19.10"}
```

**Importing an archive** takes only what belongs in a game: `versions/<n>.json`, `numbering.json`, `states/*.json` and
files with a media extension below `media/`. Everything else is skipped and reported (`skippedEntries`). Every version
and state is read before the game is created, so a broken archive doesn't leave a broken game.

**Importing a bundle** creates a game whose only version is 1. Media paths in it may be relative (from a bundle) or
URLs of media on the box (from old savegames); media that are found on the box or a plugged-in stick are copied into
the new game, the others are reported as missing (`missingMedia`), and their paths are kept, so uploading a file of
the same name later fixes them.

## Format versions and migrations

| Version | What it is |
|---|---|
| savegame 0–3 (`CURRENT_SAVEGAME_VERSION` = 3) | Before games were stored on the box: one file `{version, teams, question, gameState}`, downloaded from the master. Its media were URLs on a stick. |
| format 4 (`CURRENT_GAME_FORMAT_VERSION`) | Versions, states and bundles as described above, each with `formatVersion` and `kind`. |

Changes from savegame 2 to 3: `mediaState` (`EVideoStates`) was replaced by `mediaQuestionState`, and `mediaVolume`,
question `notes` and slideshows were added.

`GameFileHelper.toBundle` (`client/src/app/helper/game-file.helper.ts`) turns a file from a device into a bundle:

- A file with `kind: "bundle"` is taken as it is.
- A savegame with `version` 2 or 3 becomes a bundle with version 1 of the game. If it has a `gameState`, it also
  gets a state (version 2's `mediaState` is dropped, and the media state and volume get their defaults). A savegame
  that was never played becomes a game without a state.
- Anything else is refused.

Within format 4, files are **not migrated**: `formatVersion` is written, but not checked when a file is read. New
fields are added as optional, and the code treats a missing field as "the behavior from before" (see `scoring`,
`themeId`, `welcome`, `points`). Keep it that way. If a change can't be expressed like this, raise
`CURRENT_GAME_FORMAT_VERSION` and convert older files where they are read.
