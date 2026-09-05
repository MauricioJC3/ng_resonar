# Project Context — `ng_resonar` (Resonar)

Detected: 2026-09-05
Persistence backend: **openspec** (file-based; Engram MCP was down at init)

## IMPORTANT: no Angular despite the folder name

The repo folder is `ng_resonar` and the `ng_` prefix suggests Angular. **There is
NO Angular in this project.** The frontend is **React 18** with Vite. Do not
scaffold Angular, do not look for `angular.json`, do not use RxJS/NgModules
patterns. Future SDD phases must treat this as a React + Vite SPA.

## What Resonar is

Self-hosted, ad-free music + YouTube player. A single-user app: searches YouTube
Music / YouTube via `ytmusicapi`, resolves stream URLs with `yt-dlp`, muxes with
`ffmpeg`, caches resolved stream URLs in Redis, and streams audio/video to a
React PWA client. Server-side playlists, saved-video library, lyrics,
SponsorBlock, Last.fm scrobbling, and batch downloads already exist.

## Repository shape

```
ng_resonar/
├── backend/            FastAPI service (Python 3.12)
│   ├── app/
│   │   ├── main.py         app factory, lifespan, router registration
│   │   ├── config.py       pydantic-settings Settings (env-driven)
│   │   ├── cache.py        Redis / in-process TTL cache factory
│   │   ├── deps.py         shared singletons (cache, http client)
│   │   ├── routers/        HTTP layer: search, stream, video, videolib,
│   │   │                   sponsorblock, lyrics, playlists, settings, download
│   │   └── services/       domain logic: ytmusic, ytdlp, playlists, videolib,
│   │                       importer, audiobatch, appsettings, scrobble, proxy
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/          React 18 + Vite 6 SPA (package name: resonar-web)
│   ├── src/
│   │   ├── main.tsx, App.tsx
│   │   ├── api.ts          centralized fetch layer (BASE = "/api")
│   │   ├── types.ts        shared TS types
│   │   ├── components/     ~18 function components (.tsx)
│   │   ├── state/          custom stores + player reducer context
│   │   └── styles.css      ~1702 lines, hand-written, single file
│   ├── public/            manifest.webmanifest, sw.js, icons
│   ├── package.json, vite.config.ts, tsconfig.json
│   ├── nginx.conf         prod static serving + /api proxy
│   └── Dockerfile         node:22 build -> nginx:1.27 serve
├── config/             mounted read-only into backend (cookies.txt etc.)
├── docker-compose.yml  redis + backend + frontend(nginx)
└── data/  media/       gitignored runtime volumes (JSON persistence, saved files)
```

## Tech stack

### Frontend (`frontend/`, package `resonar-web`)

- **React 18.3** + **react-dom 18.3** (function components only; no class components)
- **Vite 6** build tool; dev server on :5173 proxies `/api` -> `http://localhost:8000`
- **TypeScript 5.6**, `strict: true`, `noEmit`, `moduleResolution: bundler`, `jsx: react-jsx`
- **Plyr 3.7** media player, themed entirely through CSS custom properties
- **No CSS framework** — no Tailwind, no CSS-in-JS. One hand-written `src/styles.css`
  with `:root` custom properties and BEM-ish class names (`.app`, `.main`, `.player`, ...)
- State management (no Redux/Zustand/Jotai libs):
  - Custom stores built on `useSyncExternalStore` with a cached snapshot + `Set` of
    listeners + `emit()` (`src/state/library.ts`, `nowPlaying.ts`, `playlists.ts`,
    `savedVideos.ts`, `settings.ts`, `mediabus.ts`)
  - One `useReducer` + Context provider for the play queue (`src/state/player.tsx`,
    `PlayerProvider` / `usePlayer`)
- **localStorage** for client-persisted state; keys namespaced `resonar:*`
  (`resonar:library`, `resonar:radio`, ...)
- **PWA**: `public/manifest.webmanifest`, hand-written `public/sw.js`, MediaSession API
- Scripts: `dev`, `build`, `preview` only — **no lint, no test, no typecheck script**

### Backend (`backend/`, FastAPI app `Resonar API`)

- **Python 3.12** (slim Docker image), dependencies pinned in `requirements.txt`
  (`yt-dlp` intentionally unpinned)
- **FastAPI 0.115** + **uvicorn[standard] 0.34** (single worker)
- **httpx 0.28** async client (shared singleton in `deps.http`)
- **ytmusicapi 1.10** — YouTube Music search / related / home feed
- **yt-dlp** (unpinned) + **ffmpeg** (installed in image) — stream extraction & muxing
- **redis 5.2** — resolved stream-URL cache; falls back to in-process TTL cache when
  `REDIS_URL` unset (`app/cache.py`)
- **pydantic-settings 2.7** — `Settings` class reads env vars (`app/config.py`)
- No ORM, no SQL database. Persistence is **JSON files** under `settings.data_dir`
  (`/data` in container, `./data` on host): `playlists.json`, `settings.json`, etc.
- No `pyproject.toml`, no `pytest`, no linter/formatter config

### Infrastructure

- **docker-compose** (`name: resonar`): `redis:7-alpine` + `backend` (build ./backend,
  expose 8000) + `frontend` (build ./frontend, publish `${PORT:-8080}:80`)
- Backend volumes: `./config:/config:ro`, `./media:/media`, `./data:/data`
- Backend env: `REDIS_URL`, `CORS_ORIGINS`, `STREAM_CACHE_TTL`, optional
  `YTDLP_COOKIES`, `YTDLP_PROXY`
- Prod: nginx serves the built SPA and reverse-proxies `/api` to the backend container
- Health check: `GET /api/health` -> `{"ok": true}`

## Architecture patterns & conventions

### Backend

- **Layered**: `routers/` (HTTP + validation) -> `services/` (domain logic) ->
  JSON file / external API. Routers stay thin; services own state.
- Router style: `router = APIRouter(tags=["<name>"])`; registered in `main.py` with
  `prefix="/api"`. Path handlers are `async def`.
- Request bodies are Pydantic `BaseModel` classes declared in the router module
  (`CreateBody`, `RenameBody`, `TracksBody`, `ReorderBody`, ...). Field names are
  **camelCase** to match the JS client (e.g. `fromUrl`).
- Errors: raise `fastapi.HTTPException(status_code=..., detail="...")`. Some detail
  strings are in Spanish (`"playlist not found"`, `"no se encontraron pistas..."`).
- List responses are commonly wrapped: `{"results": [...]}`. Single-entity responses
  return the object directly.
- Service module pattern (see `services/playlists.py` — **reuse this for new
  file-persisted features like history**):
  - `_FILE = os.path.join(settings.data_dir, "<name>.json")`
  - `_lock = threading.Lock()` guarding all mutations
  - `ensure()` creates `data_dir` + seeds an empty file; called from `main.py` lifespan
  - `_load()` -> dict, tolerant of `OSError` / `JSONDecodeError` (returns `{}`)
  - `_save(data)` -> atomic write: write `_FILE + ".tmp"` then `os.replace(tmp, _FILE)`
  - `json.dump(..., ensure_ascii=False)`
  - Public module-level functions (no classes) for each operation
- Shared singletons (`deps.cache`, `deps.http`) are created in the `lifespan`
  context manager, not at import time.
- Config is env-only via `pydantic_settings.BaseSettings`; no config files checked in.

### Frontend

- **Function components** in `src/components/*.tsx`, one component per file, PascalCase.
- **Centralized API layer** in `src/api.ts`: private `getJSON<T>(path)` and
  `send<T>(path, method, body?)` helpers, `BASE = "/api"`, named exported functions
  per endpoint. Network errors throw `Error("<status> <detail>")`; several calls
  `.catch(() => <fallback>)` to degrade gracefully.
- **Shared types** live in `src/types.ts` and are imported with `import type`.
- **State stores** (`src/state/`): the `useSyncExternalStore` pattern requires a
  stable snapshot reference — keep a module-level `snapshot`, only reassign it in
  `emit()` when data actually changed. Mutators write localStorage then `emit()`.
- **Play queue** is the exception: `useReducer` in `src/state/player.tsx` with a typed
  `Action` union, `PlayerProvider`, and `usePlayer()` hook that throws if used
  outside the provider.
- **Styling**: add rules to the single `src/styles.css`. Use existing `:root` custom
  properties (`--bg`, `--bg-elev`, `--text`, `--accent`, `--radius`, `--shadow`,
  Plyr `--plyr-*` overrides). Class naming is BEM-ish / block-scoped
  (`.app`, `.main`, section-prefixed classes). Layout uses CSS Grid with
  `grid-template-areas`. The current palette is a single dark violet theme.
- localStorage access is always wrapped in `try/catch` with `/* ignore */`.

## Testing capabilities

**Strict TDD Mode: DISABLED.**

No test runner exists in either project. The frontend `package.json` defines only
`dev` / `build` / `preview`. The backend has no `pyproject.toml`, no `pytest.ini`,
no `conftest.py`, no test dependencies. There is no workspace-level test command
that covers every in-scope project, so per the SDD Decision Gates `strict_tdd`
falls closed to `false` (no-runner fallback). Downstream `/sdd-apply` and
`/sdd-verify` run in Standard Mode.

| Project     | Stack                    | Test command | Framework | Linter | Type checker            | Formatter |
| ----------- | ------------------------ | ------------ | --------- | ------ | ----------------------- | --------- |
| `frontend/` | React 18 + Vite 6 + TS   | —            | —         | —      | `tsc --noEmit` (no script) | —      |
| `backend/`  | FastAPI + Python 3.12    | —            | —         | —      | —                       | —         |

- Unit / Integration / E2E: not available in either project.
- Coverage: not available.
- Quality tooling: TypeScript strict compiler is configured (`tsconfig.json`) but
  no `typecheck` npm script and no ESLint / Prettier / Ruff / Black / mypy config.
- If a change needs test coverage, the SDD proposal must also introduce the test
  tooling (e.g. Vitest + React Testing Library for `frontend/`, pytest + httpx
  `TestClient` for `backend/`).

## Discoveries / notes for future phases

- **Backend is the persistence target for new stateful features.** Playback history
  and recommendations should be new routers + services following the
  `services/playlists.py` JSON-file pattern (`./data/history.json`, new
  `/api/history` and `/api/recommendations` under the `/api` prefix, registered in
  `main.py`, seeded from `lifespan`).
- **Single-user assumption is baked in** — no auth, no per-user scoping anywhere.
  History/recommendations can safely be global.
- **No test safety net** — changes are verified by build + manual/functional checks.
  `docker-compose` up is the integration environment.
- **`build` is discouraged by project rules** ("Never build after changes") — do not
  run `npm run build` / docker builds as a verification step unless asked.
- The upcoming redesign (new palette, light + dark themes, motion system, mobile-first
  navigation) touches `src/styles.css` heavily and will likely need it split or a
  theming layer (CSS custom properties already make dark/light feasible via a
  `data-theme` attribute on `:root`). A future-native-app goal means keeping the API
  contract clean and the client presentation-only.
- Client already uses MediaSession + a service worker; redesign work must keep the
  PWA manifest / `sw.js` in sync (theme color, icons).
- No CI configuration is present in the repo.
