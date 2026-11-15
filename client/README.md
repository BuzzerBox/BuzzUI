# Client

The Angular app of the BuzzerBox: both the **game master** (`/master`, the host's phone, tablet or laptop) and the
**screen** (`/screen`, the TV; the box's Chromium opens `/screen/`). `/choose` lets a device pick its role.

```sh
cp ../config.dev.json.example ../config.dev.json   # once; the build imports it
npm install
npm start            # ng serve on http://localhost:4200, with the game server from ../server in dev mode
npm test             # Karma/Jasmine in Chrome; --watch=false --browsers=ChromeHeadless for one run
npm run lint         # angular-eslint
npm run build        # production build to dist/client
```

Some older specs and about 200 lint errors fail on `main` already; compare with `main`, see the
[development setup](../docs/development.md#tests-and-lint).

## Where things are

| Path | What |
|---|---|
| `src/app/master/` | The host's pages: home, load and prepare a game, the editor (`setup`), the storage manager, the play page |
| `src/app/screen/` | The display |
| `src/app/shared/play-ui/` | The play page's parts: question, media controls, teams, the buzzer button, the grading dialog |
| `src/app/services/game.service.ts` | The state and packet handling of both roles |
| `src/app/themes/` | The screen themes |
| `src/i18n/` | The texts, German and English |

The [architecture](../docs/architecture.md) explains how the client talks to the server, and how themes and languages
work.
