# Exploration — `redesign-and-history`

Investigation only. Persistence backend is **openspec** (file-based); Engram MCP was
**down** (`CONNECTION_CLOSED`), so no `mem_save` was performed. `.codegraph/` is not
present in this repo, so this used Read/Grep/Glob.

---

## PART A — Full visual redesign

### A1. Inventory of `frontend/src/styles.css` (1702 lines, single hand-written file)

Section-delimited by `/* ---------- <name> ---------- */` banners:

| Lines | Section |
|---|---|
| 1–26 | `:root` custom properties (colors + `--radius` + `--shadow` + all `--plyr-*`) |
| 28–66 | reset, `html/body/#root`, `button`, `a`, `::-webkit-scrollbar` |
| 68–114 | App shell (`.app`, `.main`, `.view`, `.view__title`, `.view__subhead`) |
| 116–197 | Sidebar (`.sidebar*`) |
| 199–258 | Shared bits (`.hint`, `.empty*`, `.eq`, `@keyframes eq`) |
| 260–354 | Search bar (`.searchbar*`) |
| 356–562 | Track list (`.track*`, `.track__menu*`, `.tracklist--pl`) |
| 564–670 | Video grid (`.videogrid`, `.vcard*`) |
| 672–747 | Watch view (`.watch*`) |
| 749–861 | Buttons / segmented / badges (`.btn*`, `.segmented*`, `.savebox*`, `.badge*`, `.spinner`, `@keyframes spin`) |
| 863–969 | Saved video rows (`.srow*`) |
| 971–1114 | Player bar (`.player*`) |
| 1116–1273 | Queue drawer (`.drawer*`, `.qrow*`, `@keyframes drawer-in`) |
| 1275–1322 | Misc chips / flashes (`.chip*`, `.watch__skip`, `.player__download`) |
| 1324–1441 | Playlists (`.view__bar*`, `.plgrid`, `.plcard*`, `.pldetail*`) |
| 1443–1549 | Lyrics (`.lyrics*`) |
| 1551–1606 | Settings (`.settings`, `.card*`, `.field*`) |
| 1608–1702 | Responsive — single `@media (max-width: 900px)` block |

**`:root` tokens (l.1–26)** — one dark violet theme, no light variant:
- Surfaces `--bg #0b0910`, `--bg-elev #14111c`, `--bg-elev-2 #1d1830`
- Lines `--line #2a2440`, `--line-soft #201b30`
- Text `--text #f0edf7`, `--text-dim #9b93b4`, `--text-faint #6f6788`
- Accent `--accent #8b5cf6`, `--accent-soft #a78bfa`, `--accent-2 #22d3ee`; `--danger #f87171`
- `--radius: 14px`, `--shadow: 0 20px 60px rgba(0,0,0,.5)`
- Plyr: `--plyr-color-main`(→`--accent`), `--plyr-audio-controls-background: transparent`,
  `--plyr-audio-control-color`(→`--text-dim`), `--plyr-audio-control-color-hover`(→`--text`),
  `--plyr-menu-background`(→`--bg-elev-2`), `--plyr-menu-color`(→`--text-dim`),
  `--plyr-range-track-height: 5px`, `--plyr-range-thumb-height: 13px`, `--plyr-font-family: inherit`

**No motion tokens exist.** ~40 hard-coded inline transition times (`0.12s`–`0.25s`).
Three `@keyframes`: `eq`, `spin`, `drawer-in` (reused by `.drawer`, `.lyrics`,
`.watch__skip`). No `prefers-reduced-motion`.

**Raw color literals that bypass tokens** (must be promoted for theming):
`rgba(0,0,0,0.5)` scrims (`.track__art-play` l.433, `.drawer__scrim` l.1121,
`.drawer` shadow l.1136); `#fff` on-media text (`.track__art-play`, `.vcard__dur`,
`.vcard__play`, `.srow__play`, `.srow__dur`, `.watch__hd`, `.watch__skip`,
`.player__badge`); `.watch__stage { background:#000 }` l.697; `rgba(0,0,0,0.82)`
duration pills; `#6d28d9` in `.btn--accent` gradient l.775; `rgba(0,0,0,0.8)`
`.watch__skip`. Everything else already uses `var(--*)` or token-derived
`color-mix(in srgb, var(--accent) X%, transparent)` — those theme cleanly.
`.main` has two decorative `radial-gradient` accent washes (l.85–96).

**Layout** — `.app` = `display:grid; grid-template-columns:244px 1fr;
grid-template-rows:1fr 90px; grid-template-areas:"sidebar main"/"player player";
height:100dvh`. One breakpoint `@media (max-width:900px)` restacks to rows,
sidebar → horizontal strip, labels hidden, and **`.player__center` (transport +
`<audio>`) and `.player__download` are `display:none`** — mobile currently has no
visible seek/transport.

**Plyr theming** — 100% via the `--plyr-*` props in `:root`; `plyr/dist/plyr.css`
imported from JS in `PlayerBar.tsx` + `WatchView.tsx`. Only class touches:
`.watch__stage .plyr { border-radius:16px }`, `.player__center .plyr { flex:1;
min-width:0 }`. A light theme needs a per-theme `--plyr-*` block.

**Font** — Inter via Google Fonts `<link>` in `index.html`.

### A2. Component inventory (`frontend/src/components/`, 17 + `Icon`)

Function components, one per file, BEM-ish classes, **zero inline styles**, no CSS framework.

| Component | Role | Owns | Redesign impact |
|---|---|---|---|
| `App.tsx` | Shell + routing: `useState<View>` (`search\|videos\|playlists\|library\|settings`) + `watching: VideoItem\|null` + `openPlaylist: string\|null`; renders `.app` grid, `<main class="main">`, `<Sidebar>`, `<PlayerBar>`. `navigate()` clears overlays + sets view. **No URL / history / deep links.** | `.app`, `.main` in JSX | **HIGH** for nav/layout — grid areas + view-state model live here |
| `Sidebar.tsx` | Left nav, static `NAV` array (5 items), active class, library count badge. One `<nav>` + `.map`. | `.sidebar*` | **HIGH** conceptually, tiny markup → cheap rewrite |
| `PlayerBar.tsx` | Audio player: Plyr on hidden `<audio>`; queue + lyrics panels; radio (auto-extend queue via `related()`); Web Audio volume-leveling; MediaSession; keyboard shortcuts; scrobble (`scrobbleNowPlaying` on load l.259, `scrobbleSubmit` after ≥240s or half l.156). | `.player*` | MEDIUM restyle; HIGH if full-screen now-playing added |
| `WatchView.tsx` | Video view: Plyr `<video>`; SponsorBlock fetch + auto-skip; save-HD flow; related grid via `searchVideos(video.title)`; `player.on("play")→claimPlayback("video")` l.99. | `.watch*` (+ reuses `.videogrid`, `.btn`, `.badge`, `.chip`) | MEDIUM restyle |
| `SearchView.tsx` | Search + `homeMusic()` feed. | reuses `.view`, `.tracklist`, `.view__subhead` | LOW–MED; natural host for "For you" recs |
| `VideosView.tsx` | Video search + `trendingVideos()`; paste-link → `videoInfo()`; imports `../lib/youtube`. | reuses `.view`, `.videogrid` | LOW–MED |
| `LibraryView.tsx` | Tabbed songs/videos. | `.segmented` | LOW |
| `PlaylistsView.tsx` | Playlist grid + create/import via `window.prompt`. | `.view__bar*`, `.plgrid`, `.plcard*` | LOW–MED |
| `PlaylistDetailView.tsx` | Detail: header, play/rename/batch-download/delete, reorder rows. | `.pldetail*` (+ reuses `.watch__back`, `.tracklist--pl`, `.btn*`) | LOW–MED |
| `TrackRow.tsx` | Tracklist row; hover actions, add-to-playlist + download-format menus. | `.track*`, `.track__menu*` | MEDIUM — most-repeated unit; column retune for mobile |
| `PlaylistTrackRow.tsx` | `TrackRow` + up/down reorder + remove. | reuses `.track*` | MEDIUM |
| `VideoCard.tsx` | Video thumb card, `formatViews()`. | `.vcard*` | LOW |
| `SavedVideoRow.tsx` | Saved HD video row. | `.srow*` | LOW |
| `QueuePanel.tsx` | Fixed drawer over `.drawer__scrim`; jump/move/remove. | `.drawer*`, `.qrow*` | MEDIUM — bottom sheet on mobile |
| `LyricsPanel.tsx` | Fixed centered modal; synced lyrics follow `useNowPlaying().time`; click → `seek()`. | `.lyrics*` | MEDIUM — sheet/full-screen on mobile |
| `SearchBox.tsx` | Debounced autocomplete input. | `.searchbar*` | LOW |
| `SettingsView.tsx` | Scrobble config cards. | `.settings`, `.card*`, `.field*` | LOW — **home of the theme-toggle UI** |
| `Icon.tsx` | Inline `<svg viewBox="0 0 24 24">` sprite map, stroke-based, `currentColor`. | none | add `sun`/`moon`/`home` glyphs |

State stores (context only): `state/library.ts`, `savedVideos.ts`, `playlists.ts`
(`useSyncExternalStore` + localStorage `resonar:*`), `player.tsx` (`useReducer`
queue), `nowPlaying.ts` (playback clock), `mediabus.ts` (music/video mutex),
`settings.ts` (server settings snapshot).

### A3. Theming approach

| Approach | Mechanism | Pros | Cons |
|---|---|---|---|
| **1. `data-theme` on `<html>` + token overrides** | `:root{…dark…}`; `:root[data-theme="light"]{…}`; `@media (prefers-color-scheme:light){:root:not([data-theme]){…}}`. Toggle sets `document.documentElement.dataset.theme` + writes `resonar:theme`; inline `<head>` script applies pre-paint; `color-scheme` per theme. | one source of truth; every `var(--x)` themes automatically; explicit choice beats system; no SSR/hydration issues; `color-scheme` fixes range inputs/scrollbars | must promote ~25 raw literals to tokens; per-theme `--plyr-*` block; needs anti-FOUC script |
| 2. `@media prefers-color-scheme` + `.theme-*` class | light values in a media query; class forces override | marginally less attribute plumbing | still needs the same JS for "remember choice"; token block duplicated in media query; class on `<body>` is a hop from `:root` |

**Recommendation: Approach 1.** Least churn for a codebase already 100% on
`var(--*)`. Toggle in `SettingsView`, plus an always-reachable entry point
(bottom-nav overflow or player actions).

New token shapes for "cool & serene": `--bg` dark `~#0E1414` / light `~#F2F5F4`;
`--accent ~#6DA89B`; blue-grey text ramp; softer multi-layer `--shadow`; new
`--dur-*`/`--ease-*`; `--scrim`, `--on-media` (replaces `#fff`), `--stage-bg`
(replaces `#000`).

### A4. Splitting `styles.css`

**Recommended.** Class names don't change → low risk. Proposed (import order = cascade order):

```
src/styles/index.css   -> @imports below in order
  tokens.css      :root dark, [data-theme=light], @media default, --dur-*/--ease-*, --plyr-* per theme, color-scheme
  base.css        reset, html/body, typography, scrollbars, ::selection
  layout.css      .app grid, .main, .view*, responsive shell, bottom-nav
  motion.css      @keyframes + prefers-reduced-motion guard
  components/     sidebar nav track player watch drawer lyrics playlist video search settings buttons shared
```

`main.tsx`: `import "./styles.css"` -> `import "./styles/index.css"`. Do the split
as its **own no-behaviour-change PR slice**.

### A5. Motion system (no animation lib)

- Tokens: `--dur-fast:140ms; --dur-base:240ms; --dur-slow:300ms;
  --ease-standard:cubic-bezier(.4,0,.2,1); --ease-emphasized:cubic-bezier(.2,0,0,1);
  --ease-exit:cubic-bezier(.4,0,1,1)`.
- Replace the ~40 inline times with `var(--dur-*) var(--ease-*)`, landing in the 220–320ms band.
- Pure CSS covers: hover/focus, `.eq`, `.spinner`, `drawer-in`->`sheet-in`, thumb
  scale, row fades, sheet slide-up.
- `@media (prefers-reduced-motion: reduce){ *,*::before,*::after{
  animation-duration:.001ms!important; transition-duration:.001ms!important; } }` in `motion.css`.
- **JS-driven animation needed for:**
  - **View transitions** between `App.tsx` `view` states (instant swap today):
    native `document.startViewTransition()` / `@view-transition` — Chromium-only,
    zero deps, wrap `navigate()`; fallback = CSS crossfade via `key` on `<main>`
    child or no-op.
  - **Shared-element expand for now-playing** (`PlayerBar` mini -> full-screen
    `NowPlayingView`): `view-transition-name` on artwork + title tweens for free
    inside `startViewTransition`; baseline fallback = slide-up sheet
    (`transform: translateY(100%)->0`), optionally FLIP.
  - Queue/Lyrics -> bottom sheets (CSS-only fine; drag-to-dismiss would need pointer JS, optional).

| Motion approach | Pros | Cons |
|---|---|---|
| **CSS tokens + keyframes + native View Transitions (recommended)** | no deps; matches hand-written-CSS ethos; free shared-element on Chromium; trivial reduced-motion | View Transitions unsupported on Firefox/older Safari -> needs fallback; no springs/gestures |
| add `framer-motion`/`motion` | declarative, springs, cross-browser shared-element, gestures | +30–50kb dep; wraps components; contradicts minimal-deps stance |
| add GSAP | powerful timelines | heavy, imperative, overkill |

### A6. PWA sync points when palette changes

- `frontend/index.html` l.6 `<meta name="theme-color" content="#0b0910">` -> new
  dark bg; **add** `<meta name="theme-color" media="(prefers-color-scheme: light)"
  content="~#F2F5F4">`; also update at runtime from the toggle.
- `index.html` l.12 `apple-mobile-web-app-status-bar-style: black-translucent` —
  re-evaluate for light theme.
- `frontend/public/manifest.webmanifest` — `background_color` + `theme_color` both
  `#0b0910` -> new dark bg (single value; drives splash).
- `frontend/public/sw.js` — `const CACHE = "resonar-shell-v1"` **must bump to
  `-v2`** (the `activate` handler purges non-current caches), else installed PWAs
  keep the old shell/CSS/icons forever. `SHELL` list stays valid; `/api/` never cached.
- Icons — regenerate all six if the brand mark leaves violet: `public/icon.svg`
  (favicon), `icon-maskable.svg`, `icon-192.png`, `icon-512.png`,
  `icon-maskable-512.png`, `apple-touch-icon.png`. Brand glyph in `--accent`
  (`Sidebar.tsx` l.26). Icon regen is a design-asset task, not a build.
- Minor: `backend/app/routers/settings.py` l.58–63 `lastfm_callback` inline
  `background:#0b0910;color:#f0edf7`.

### A7. Mobile-oriented navigation

Current: `App.tsx` has `view` (5), `watching` (overlay), `openPlaylist` (sub-view);
`navigate(v)` clears overlays + `setView`. No `history`/URL/deep links. `Sidebar`
maps a static `NAV` array.

Becoming responsive bottom-nav — **no state-model change**: `Sidebar` -> `<Nav>`
that renders as a left rail >= breakpoint and a fixed bottom bar below (either
`.app` grid gains a `"nav"` row on mobile, or `position:fixed;bottom:0` +
`padding-bottom` on `.main`). `NAV` unchanged. Full-screen now-playing/watch
already render in place of `content` — make them `position:fixed;inset:0` above the
nav or hide the nav while open. Restore a mobile mini-player/transport (today
`.player__center` is hidden < 900px).

| Router option | Pros | Cons | Effort |
|---|---|---|---|
| **Keep hand-rolled switch (recommended)** | zero routing churn; nginx SPA `try_files` already fine; no dep | no back-button/deep-link/shareable URLs; Android back gesture exits PWA | none |
| Switch **+ `history.pushState` + `popstate`** (optional) | back gesture navigates; no dep; ~30 lines | manual 3-var <-> URL sync; not "real" routing | Low |
| Adopt `react-router` | back-button, deep links, code-split routes | new dep; rewrite `App.tsx` routing; every `onWatch/onOpen/navigate` -> `navigate()` | Medium |

**Recommendation:** defer `react-router` to its own change (a future native app
consumes `/api/*`, not React routing); keep the switch, optionally add
`pushState`/`popstate`.

---

## PART B — Backend-persisted playback history + recommendations

### B1. Reference JSON pattern (`backend/app/services/playlists.py`) — mirror verbatim

- Module-level functions, **no class**.
- `_FILE = os.path.join(settings.data_dir, "playlists.json")` (`settings.data_dir`
  default `/data` container / `./data` host, from `config.py`).
- `_lock = threading.Lock()` guards every mutation.
- `ensure()` — `os.makedirs(data_dir, exist_ok=True)` + seed file if missing;
  **called from `main.py` lifespan** (`playlists_service.ensure()`).
- `_load()` — `ensure()`, open utf-8, `json.load`; catches `(OSError,
  json.JSONDecodeError)` -> `{}`.
- `_save(data)` — **atomic**: write `_FILE + ".tmp"`, `os.replace(tmp, _FILE)`;
  `json.dump(..., ensure_ascii=False)`.
- Every mutator: `with _lock: data=_load(); <mutate>; _save(data); return …`.

Router (`routers/playlists.py`): `APIRouter(tags=["playlists"])`, `async def`
handlers, Pydantic `BaseModel` bodies declared in-module with **camelCase** fields,
`raise HTTPException(404, "…")`, list responses wrapped `{"results":[...]}`, single
entity returned directly, registered in `main.py` with `prefix="/api"`.

**New files:**
- `backend/app/services/history.py` — `_FILE=…/history.json`; `_lock`; `ensure()`
  (seed `{"entries":[]}`); `_load()`; `_save()` atomic; `add(entry)`;
  `list_entries(limit)` (newest-first); `clear()`; optional `remove(video_id)`.
- `backend/app/routers/history.py` — `GET /api/history` -> `{"results":[...]}`;
  `POST /api/history` (body `HistoryBody`); optional `DELETE /api/history`.
  `GET /api/recommendations` here or in `routers/recommendations.py` ->
  `{"results": Track[]}`.
- `main.py` — import + `include_router(..., prefix="/api")` +
  `history_service.ensure()` in `lifespan` next to `playlists_service.ensure()`.

### B2. `/api/related/{videoId}`, `/api/home`, `/api/videos/trending`

**`GET /api/related/{video_id}`** — `routers/search.py` l.38, `limit` 1..50 default
25 -> `{"results": await ytmusic.related(video_id, limit)}`. **NOT cached** (unlike
`/search`, `/suggest`, `/home`). `ytmusic._related_sync` tries
`get_watch_playlist(radio=True)` -> `playlistId="RDAMVM"+id` -> `get_song` + search
by `"<author> <title>"`; each step `except Exception: continue`; **returns `[]` on
total failure, never raises**. Items are `_norm()` = the **`Track`** shape (`id`,
`title`, `artists: string[]`, `album`, `duration`, `durationSeconds`, `thumbnail`).
Frontend `api.ts related()` also `.catch(()=>[])`.

**`GET /api/home`** — EXISTS. `search.py` l.43, caches key `home:music` 1800s,
`ytmusic.home()` (`get_home(limit=8)`, dedupe, fallback `search("top
hits","songs",30)`) -> `{"results": Track[]}`.

**`GET /api/videos/trending`** — EXISTS. `routers/video.py` l.25, caches key
`home:videos` 1800s, = `ytmusic.home()` tracks re-mapped through
`_as_video_item()` -> **`VideoItem`** (`id`, `title`, `uploader`, `duration`,
`durationSeconds`, `views:null`, `thumbnail` with
`https://i.ytimg.com/vi/{id}/hqdefault.jpg` fallback). Not real "trending", just
home re-shaped.

**`api.ts` <-> backend cross-check** — all present: `homeMusic()->/home`,
`trendingVideos()->/videos/trending`, `searchVideos()->/videos/search`,
`videoInfo()->/videos/info/{id}`, `related()->/related/{id}`, `search()->/search`,
`suggest()->/suggest`. **Resolved: both `/api/home` and `/api/videos/trending` exist.**

**Cache (`backend/app/cache.py`)** — `deps.cache` is a `Cache` (`get/set/delete`);
`RedisCache` (JSON) when `REDIS_URL` set, else `MemoryCache` (in-process TTL dict).
`set(key,value,ttl)`, `ttl=0` = no expiry. Same store used by stream URLs / search
/ home -> use it for recommendations.

### B3. Where to record a "play"

- **Songs** — `PlayerBar.tsx` `useEffect(…, [current])` l.249 (`audio.src =
  streamUrl(current.id); audio.play()`), the exact spot `scrobbleNowPlaying(current)`
  runs (l.259). `current` is a `Track` from `usePlayer()`. Add `recordPlay(current,
  "song")` beside it. A `scrobbledRef` once-guard already exists for the *submit*
  threshold (l.156: `d>30 && (t>=240 || t>=d/2)`) if "confirmed play" semantics are wanted.
- **Videos** — `WatchView.tsx`: source `useEffect(…, [srcUrl, video.id])` l.111, or
  better the Plyr `player.on("play", …)` l.99. `video` is a `VideoItem`. Add
  `recordPlay(video, "video")`.
- `state/nowPlaying.ts` is only a playback clock.
- New `api.ts` fn, fire-and-forget like `scrobbleNowPlaying`:

```ts
export function recordPlay(item: Track | VideoItem, kind: "song" | "video", source?: string): void {
  const body = kind === "song"
    ? { videoId:(item as Track).id, title:item.title, artist:(item as Track).artists[0], thumbnail:item.thumbnail, kind, source }
    : { videoId:(item as VideoItem).id, title:item.title, artist:(item as VideoItem).uploader, thumbnail:item.thumbnail, kind, source };
  void fetch(`/api/history`, { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify(body) }).catch(()=>{});
}
```

Record **on start** (simple, enough signal), store `playedAt` for later recency decay.

### B4. Recommendation strategy

| Option | How | Pros | Cons |
|---|---|---|---|
| **A. On-demand fan-out + cache (recommended)** | last **10–15 unique** history `videoId`s -> `ytmusic.related(id, limit=15)` concurrently -> drop history items -> rank by **cross-seed frequency then seed recency** -> top ~30 `Track[]`. Cache final list in `deps.cache` key `recs:v1:{sha1(sorted last-N ids)}` TTL 1800s. **Also** add per-seed cache `related:{id}` TTL 3600s (currently `/api/related` is uncached). Fallback to `ytmusic.home()`. | reuses existing cache exactly like stream URLs/home; no new storage; near-free on cache hit; simple ranking | cold call = N x related latency; ytmusicapi brittleness xN; needs short timeouts |
| B. Precompute on write | `POST /api/history` schedules background recompute -> `data/recommendations.json` | instant reads | background-task infra; wasted compute per play; still stale between writes |
| C. Recompute every request, no cache | A minus caching | always fresh | slow every call; hammers ytmusic; rate-limit risk |

**Recommendation: Option A**, N=10–15, `limit=15` each, top ~30, both cache layers,
`home()` fallback. Frontend calls it non-blocking with a skeleton.

### B5. De-dup / privacy / size

- **Cap** `history.json` at ~500–1000 entries (`entries = entries[-CAP:]` on write).
- **Consecutive-repeat dedupe:** if newest entry has same `videoId` (optionally
  within X min), bump `playedAt` + `playCount++` instead of appending.
- **Store:** `videoId`, `title`, `artist`/`author`, `thumbnail`, `kind`
  (`song`|`video`), `playedAt` (epoch s), `playCount`, `source`
  (`search`|`radio`|`playlist`|`watch`|`home`).
- **Privacy:** single-user, no auth, no per-user scoping — history global. Still add
  `DELETE /api/history` (clear) and optionally `DELETE /api/history/{videoId}`.
  Nothing leaves the box.
- **Future native app:** pure JSON, camelCase, no cookies/session, `{"results":[...]}`
  wrapper consistent with the rest of `/api`.
- `threading.Lock` (sync) inside async handlers is fine for tiny JSON writes
  (matches `playlists.py`).

### B6. Data model

Backend Pydantic (in `routers/history.py`, camelCase):

```python
from typing import Literal
from pydantic import BaseModel

class HistoryEntry(BaseModel):
    videoId: str
    title: str
    artist: str | None = None      # Track.artists[0] for songs; VideoItem.uploader for videos
    thumbnail: str | None = None
    kind: Literal["song", "video"] = "song"
    playedAt: int                  # epoch seconds
    playCount: int = 1
    source: str | None = None

class HistoryBody(BaseModel):       # POST /api/history
    videoId: str
    title: str
    artist: str | None = None
    thumbnail: str | None = None
    kind: Literal["song", "video"] = "song"
    source: str | None = None
    playedAt: int | None = None    # server defaults to int(time.time())
```

Endpoints:
- `GET /api/history?limit=…` -> `{"results": HistoryEntry[]}` newest-first (`playedAt` desc).
- `GET /api/recommendations?limit=…` -> `{"results": Track[]}` — **reuse the existing
  `Track` shape** so the frontend reuses `types.ts` `Track` and renders with
  `TrackRow` verbatim. Optionally add `"seeds":[...]` for debug.
- `POST /api/history` -> the stored `HistoryEntry`.

Frontend `types.ts` add:

```ts
export interface HistoryEntry {
  videoId: string; title: string;
  artist?: string | null; thumbnail?: string | null;
  kind: "song" | "video";
  playedAt: number; playCount: number;
  source?: string | null;
}
```

Recommendations need **no new type** (`Track[]`). Where recs surface
(redesign-side decision): a "For you" block in `SearchView` (already renders
`homeMusic()`) or a new nav destination.

---

## Risks

- ytmusicapi is unofficial/brittle (bare `except` throughout); recommendation
  fan-out multiplies exposure to breakage + rate-limits. Mitigate: two-layer cache,
  `home()` fallback, short timeouts, capped seeds.
- **No test runner in either project** — a ~1700-line CSS refactor + new endpoints
  verified only by manual checks + `docker-compose up`. Consider adding Vitest + RTL
  smoke tests and pytest + FastAPI `TestClient` for the new routers as part of the change.
- "Never build after changes" — CSS split/theming/icons can't be verified via
  `npm run build`; rely on the dev server.
- Theme FOUC without a pre-paint inline `<head>` script.
- **`sw.js` `CACHE` version bump is mandatory** or installed PWAs never pick up the
  new shell/palette/icons.
- Combined scope far exceeds a 400-line review budget -> chain slices:
  1. tokens + motion layer + `data-theme` theming
  2. mechanical `styles.css` -> `styles/**` split, no behaviour change
  3. responsive nav + mini-player + full-screen now-playing/watch + view transitions
  4. per-view restyle passes
  5. Part B — `history` service + router + `recordPlay` hooks
  6. Part B — `recommendations` endpoint + `related` caching + "For you" UI
- `history.json` unbounded growth without caps + consecutive-dedupe.
- Recommendation cold-cache latency can be multi-second; frontend must fetch non-blocking.
- `react-router` deferral is deliberate; if deep links / back-button are in-scope
  this cycle, `App.tsx` grows meaningfully.

---

## Structured result

- **status:** analysis complete.
- **next_recommended:** `sdd-propose`
- **key open decisions for the proposal:**
  - Theming = `data-theme` on `<html>` + pre-paint script + `@media
    prefers-color-scheme` default.
  - CSS org = split into `styles/tokens|base|layout|motion|components/**` via
    ordered `@import`, as its own no-behaviour-change slice.
  - Motion = CSS `--dur-*`/`--ease-*` tokens + keyframes + `prefers-reduced-motion`
    + native View Transitions with slide-up sheet fallback.
  - Nav = responsive left-rail/bottom-nav on the existing `view` state, defer
    `react-router`, optionally add `pushState`/`popstate`.
  - History persistence = new `services/history.py` + `routers/history.py`
    mirroring `playlists.py`, `history.json`, cap + consecutive-dedupe + timestamps
    + `playCount` + `DELETE`.
  - Recommendations = on-demand fan-out + two-layer `deps.cache` + `home()` fallback.
  - Play-event hook = `recordPlay()` in `api.ts` from `PlayerBar` (`useEffect
    [current]`) and `WatchView` (`player.on("play")`), recorded on start.
  - Data shapes = `HistoryEntry` camelCase Pydantic + TS; history -> `{results:
    HistoryEntry[]}`; recommendations -> `{results: Track[]}` reusing `Track`.
