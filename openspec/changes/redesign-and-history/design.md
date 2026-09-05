# Design: Redesign and Playback History

> Size note: this document intentionally exceeds the default 800-word design
> budget. The change spans two capability areas (full visual system + backend
> history/recommendations) across 6 slices, and the phase brief mandates
> explicit coverage of token architecture, file layout, nav, motion, PWA sync,
> and both Part B endpoints. Splitting it would break traceability between the 5
> spec deltas and the implementation.

## Technical Approach

Two tracks, six chained single-PR slices, verified on the Vite dev server only
(project rule: never build after changes).

- **Part A (slices 1-4) is CSS / markup-class / small-JS-glue only.** No change
  to player lifecycle, Plyr construction/config, `<audio>` ownership,
  MediaSession, PiP, Web Audio graph, radio auto-extend, keyboard shortcuts, or
  scrobble. The redesign re-skins and re-lays-out around those systems; it never
  edits their `useEffect` bodies.
- **Slice 1** reworks the `:root` token block to the locked "cool & serene"
  palette, adds the 3-block light/dark structure, motion tokens, a per-theme
  `--plyr-*` block, promotes ~25 raw color literals to tokens, adds the
  pre-paint anti-FOUC script, and syncs all PWA assets.
- **Slice 2** mechanically splits `styles.css` into `src/styles/**` composed by
  ordered `@import`. Zero selector/cascade/behaviour change.
- **Slice 3** turns `Sidebar` into a responsive `Nav` (rail >= 860px / bottom
  bar below), restores the mobile transport, makes now-playing and watch
  full-screen on mobile, adds `history.pushState`/`popstate` view sync, and
  wires native View Transitions around the `App.tsx` content swap with a
  CSS slide-up-sheet fallback. No animation library.
- **Slice 4** applies the aesthetic per view (className / component-CSS only).
- **Part B (slices 5-6)** adds `services/history.py` + `routers/history.py`
  (mirroring `services/playlists.py` verbatim), a `recordPlay()` client hook,
  then `services/recommend.py` + `routers/recommendations.py`, plus per-seed
  caching back-filled onto `routers/search.py` `/api/related`, and the
  "For you" / "Recently played" sections in `SearchView`.

Specs covered: `theme-system`, `motion-system`, `responsive-navigation`,
`playback-history`, `music-recommendations`.

## Preservation Constraints (MUST NOT BREAK)

Each existing feature, its exact touchpoint, and how the restyle stays clear.

| Feature | Exact touchpoint | Rule the design imposes |
|---|---|---|
| **Background audio playback** | `App.tsx:63` renders `<PlayerBar />` as a direct child of `.app`, a sibling of `<main className="main">{content}</main>`. The Plyr instance + hidden `<audio ref={audioRef}>` (`PlayerBar.tsx:323`) are created in the mount-once `useEffect(..., [])` at `PlayerBar.tsx:111-181`. | `PlayerBar` stays a direct child of `.app` in every layout (rail, bottom-nav, full-screen). It is never moved inside `content`, never given a `key`, never conditionally mounted, never wrapped in a component that unmounts on view change. Slice 3 changes only the grid template around it. |
| **MediaSession / lock-screen & headset** | `PlayerBar.tsx:143-153` (`setPositionState`) and `PlayerBar.tsx:261-287` (`MediaMetadata` + `setActionHandler` play/pause/prev/next/seekbackward/seekforward/seekto) inside `useEffect([current])`. | Slices 1-4 do not touch this `useEffect`. No markup change references `navigator.mediaSession`. Slice 5 inserts one line (`recordPlay`) above the metadata block, not inside it. |
| **Picture-in-Picture** | `WatchView.tsx:81-97` Plyr `controls` array includes `"pip"` and `"fullscreen"`. | The full-screen watch relayout (slice 3) and dark `--stage-bg` restyle (slices 1/4) touch only the `.watch__stage` wrapper and `.watch` container. They MUST NOT: remove entries from Plyr's `controls` array, set `display:none` / `visibility:hidden` / `pointer-events:none` on `.plyr__controls` or `.plyr__control`, or replace/duplicate Plyr's container element. Existing `.watch__stage .plyr { border-radius }` rule stays; only its background/radii token-ise. |
| **Mini-player persistence** | The single `<footer className="player">` in `PlayerBar.tsx:295`. | The full-screen now-playing view is a **CSS expansion of the already-mounted `PlayerBar`** (a `data-expanded` / class toggle + optional `createPortal` to `document.body` of the *same* JSX subtree), NOT a new component and NOT a second `<audio>`/Plyr. State (`current`, `queue`, `radio`, `leveled`) is the same `usePlayer()` instance. `view-transition-name: np-art` is set on the existing `.player__art` `<img>`. |
| **Web Audio volume-leveling** | `PlayerBar.tsx:40-108` (`buildGraph`, `routeGraph`, `toggleLevel`, `LEVEL_KEY`). | Untouched by slices 1-4. `.player__toggle.is-on` styling is the only thing that changes. |
| **Radio auto-extend** | `PlayerBar.tsx:184-202` `useEffect` on the Plyr `ended` event calling `related()` + `appendMany`. | Untouched. |
| **Keyboard shortcuts** | `PlayerBar.tsx:205-246` `useEffect` (`keydown`). | Untouched. |
| **Scrobble hooks** | `scrobbleNowPlaying(current)` at `PlayerBar.tsx:259`; `scrobbleSubmit` at `PlayerBar.tsx:156-159`. | Slice 5 adds `recordPlay(current, "song", "player")` **immediately after `PlayerBar.tsx:258` (`scrobbledRef.current = false;`), unconditionally** - beside, not inside, the `if (scrobblingOn())` gate, and not replacing either scrobble call. |

**View Transitions containment (slice 3):** `document.startViewTransition` wraps
**only the state update that swaps `content`** (the `setView` / `setWatching` /
`setOpenPlaylist` call), invoked from a `go()` helper in `App.tsx`. It never
wraps the `App` render function and never re-renders `PlayerBar`. `PlayerBar`
carries no `view-transition-name` except the shared `np-art` on its artwork,
which participates only when the now-playing expansion toggles.

## Architecture Decisions

### Decision: 3-block token structure, bare `:root` = light

**Choice**: Follow the user-approved mockup exactly:

1. **Block 1 - bare `:root`** = full light token set + `color-scheme: light` +
   the theme-invariant tokens (radii, motion, type, light shadows, light
   `--plyr-*`). `--on-media: #F4F7F6` is identical in both themes -> declared
   here once, never repeated.
2. **Block 2 - `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { ... } }`**
   = dark token overrides + `color-scheme: dark` + dark shadows. Applies only
   when the OS is dark AND the user has not forced light.
3. **Block 3a - `:root[data-theme="dark"]`** = the same dark override set
   (verbatim copy of Block 2's body, fenced with a
   `/* DARK SET - keep in sync with @media block */` comment). Wins over any OS
   preference.
   **Block 3b - `:root[data-theme="light"]`** = explicit re-assertion of the
   light set. With the `:not([data-theme="light"])` guard on Block 2 this is
   technically redundant, but it is kept as a defensive, self-documenting
   override so a future edit to Block 2's selector cannot silently break
   forced-light.

**Alternatives considered**: (a) bare `:root` = dark per the `theme-system`
spec's wording - rejected: the locked mockup ships light as the base layer and
the phase brief pins it; behaviour (explicit choice wins, `prefers-color-scheme`
honoured first visit, no FOUC) is identical either way. (b) `.theme-*` class on
`<body>` - rejected: extra selector hop, still needs the same JS, duplicates the
token block anyway. (c) Sass map to avoid the dark-set duplication - rejected:
no build-time preprocessor in the project; a media query and an attribute
selector cannot share one rule, so ~22 lines are duplicated by necessity.

**Rationale**: The codebase is already 100% on `var(--*)`; a token swap re-themes
everything for free. `color-scheme` per block fixes native range inputs,
scrollbars, and form controls.

**Anti-FOUC script** - inline in `index.html` `<head>`, before the stylesheet
`<link>`:

```html
<script>
  (function () {
    try {
      var t = localStorage.getItem("resonar:theme");
      if (t !== "light" && t !== "dark") {
        t = window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark" : "light";
      }
      document.documentElement.setAttribute("data-theme", t);
    } catch (e) {
      document.documentElement.setAttribute("data-theme", "dark");
    }
  })();
</script>
```

`localStorage` key: **`resonar:theme`**, values `"light"` | `"dark"`. The
`SettingsView` toggle writes it (try/catch), sets
`document.documentElement.dataset.theme`, and updates the runtime
`theme-color` meta (see PWA).

### Decision: raw-literal -> token promotion map (slice 1)

Per `explore.md` A1. All promotions are 1:1 `var(--*)` substitutions; no new
selectors.

| Current literal | Sites | New token |
|---|---|---|
| `#fff` on-media text | `.track__art-play`, `.vcard__dur`, `.vcard__play`, `.srow__play`, `.srow__dur`, `.watch__hd`, `.watch__skip`, `.player__badge` | `var(--on-media)` |
| `#000` bg | `.watch__stage` (l.697) | `var(--stage-bg)` |
| `rgba(0,0,0,.5)` / `rgba(0,0,0,.8)` / `rgba(0,0,0,.82)` scrims | `.track__art-play`, `.drawer__scrim` (l.1121), `.drawer` shadow (l.1136), duration pills, `.watch__skip` | `var(--scrim)` (pills may use `color-mix(in srgb, var(--stage-bg) 82%, transparent)`) |
| `#6d28d9` gradient stop | `.btn--accent` gradient (l.775) | `var(--accent-soft)` (start) -> `var(--accent)` (end) |

Verification: after slice 1, `rg -n "#fff|#000|rgba\(0,\s*0,\s*0" src/styles*` in
rules that render visible UI returns nothing (scrim/keyframe internals excepted).

### Decision: CSS split into `src/styles/` (slice 2, mechanical)

**Choice**: `@import` order == cascade order, from a single `src/styles/index.css`:

```
src/styles/index.css
  @import "./tokens.css";         3-block :root, motion tokens, per-theme --plyr-*
  @import "./base.css";           reset, html/body, typography (Fraunces/Hanken), scrollbars, ::selection
  @import "./layout.css";         .app grid, .main, .view*, responsive shell, .nav (rail + bottom)
  @import "./motion.css";         @keyframes (eq, spin, sheet-in), prefers-reduced-motion guard
  @import "./components/sidebar.css"   (renamed nav.css)
  @import "./components/track.css"
  @import "./components/player.css"
  @import "./components/watch.css"
  @import "./components/drawer.css"    (queue/lyrics sheets)
  @import "./components/lyrics.css"
  @import "./components/playlist.css"
  @import "./components/video.css"
  @import "./components/search.css"
  @import "./components/settings.css"
  @import "./components/buttons.css"
  @import "./components/shared.css"    (.hint, .empty*, .badge*, .chip*, .spinner)
```

`main.tsx`: `import "./styles.css"` -> `import "./styles/index.css"`; delete the
old `styles.css`.

**Alternatives considered**: keep one file - rejected, the redesign roughly
doubles it and review budgets are ~400 lines. CSS Modules / bundler `@use` -
rejected, changes tooling and selector semantics.

**Rationale**: class names do not change, so risk is near zero. Slices 1 and 2
are separate PRs so a regression is bisectable.

**No-behaviour-change proof for slice 2**: (1) `git diff` shows only moved
lines + the `main.tsx` import + new `index.css`; every selector block is byte
-identical (a sorted-selector diff of old vs concatenated new is empty).
(2) Side-by-side dev-server visual pass on every view in both themes.
(3) Grep the component tree - no `className` string changed.

### Decision: single responsive `Nav`, breakpoint 860px

**Choice**: `Sidebar.tsx` becomes `Nav.tsx` with the **same props**
(`{ view: View; onNavigate: (v: View) => void }`) and the same static `NAV`
array (5 items, unchanged). One component renders both presentations; CSS picks
which is visible.

**Breakpoint: `860px`** (pinned). Rationale: the current sole breakpoint is
`900px` and it *hides* the transport - 860px is close enough to preserve the
existing desktop composition while giving the restored mobile transport room;
it clears common tablet portrait widths (768/800) into the bottom-nav band and
sits below the 320px+244px rail + comfortable `.main` min-content. One
`@media (max-width: 859.98px)` block owns every mobile rule (mirrors the
single-block convention).

`.app` grid:

```
>= 860px (rail):     grid-template-columns: 244px 1fr;
                     grid-template-rows: 1fr 90px;
                     grid-template-areas: "nav main" / "player player";

< 860px (bottom):    grid-template-columns: 1fr;
                     grid-template-rows: 1fr auto auto;   /* main / player / nav */
                     grid-template-areas: "main" "player" "nav";
                     .nav  { position: sticky; bottom: 0; }
                     .main { padding-bottom: 8px; }       /* player+nav are in-flow */
```

Full-screen now-playing / watch on mobile: rendered `position: fixed; inset: 0;
z-index` above the bottom-nav (nav stays mounted, just covered). Desktop keeps
them in `.main`.

**Alternatives considered**: `react-router` - deferred to its own change (a
future native app consumes `/api/*`, not React routing). Two separate
components (`Rail` + `BottomNav`) - rejected, duplicates the active-state and
badge logic.

### Decision: `history.pushState` / `popstate` view sync (slice 3, ~30 lines, in `App.tsx`)

State model is unchanged: `view` (5), `watching: VideoItem | null`,
`openPlaylist: string | null`.

- A `go(next)` helper wraps every state transition (`navigate`, `watch`,
  `setOpenPlaylist`, the `onClose` / `onBack` handlers). It computes the next
  `{ view, watching, openPlaylist }`, calls
  `history.pushState(nextState, "")` (no URL string - same path, history entry
  only), then applies the setters. When View Transitions are supported the
  setters run inside `document.startViewTransition`.
- On mount: `history.replaceState(currentState, "")` so the first Back has a
  target.
- One `useEffect(() => { window.addEventListener("popstate", onPop); ... }, [])`
  where `onPop(e)` reads `e.state` (or a default `{ view: "search",
  watching: null, openPlaylist: null }` when `null`) and applies the three
  setters directly - it does **not** push again.
- `watching` is a plain-JSON `VideoItem`, so it round-trips through
  `history.state` intact; `openPlaylist` is an id string.
- **First load / refresh with a deep path**: `history.state` is `null` ->
  `onPop`-style default resolves to `view: "search"`, no overlay - always a
  valid view. No URL parsing, no `react-router`. Deep-linking is explicitly out
  of scope (`responsive-navigation` spec).

Mapping table:

| Transition | pushState payload |
|---|---|
| pick nav item `v` | `{ view: v, watching: null, openPlaylist: null }` |
| open video `vi` | `{ view, watching: vi, openPlaylist: null }` |
| open playlist `id` | `{ view: "playlists", watching: null, openPlaylist: id }` |
| close watch / back from playlist detail | previous entry via native Back (no push) |

### Decision: motion via tokens + native View Transitions, no library

- **Tokens** (locked): `--dur-fast 140ms`, `--dur-base 240ms`,
  `--dur-slow 320ms`, `--ease-standard`, `--ease-emphasized`, `--ease-exit`.
- **Search-replace map** for the ~40 inline durations (all land in the
  220-320ms band except micro-interactions):

  | Current inline value | Replacement |
  |---|---|
  | `0.12s` / `.12s` / `120ms` (hover, thumb scale, small fades) | `var(--dur-fast) var(--ease-standard)` |
  | `0.15s` / `0.18s` / `0.2s` / `0.22s` / `0.25s` (default transitions) | `var(--dur-base) var(--ease-standard)` |
  | drawer / sheet / lyrics slide-in, view crossfade | `var(--dur-slow) var(--ease-emphasized)` (enter) / `var(--ease-exit)` (leave) |

- **`prefers-reduced-motion` guard** lives in `motion.css` (last import before
  components so it wins):
  `@media (prefers-reduced-motion: reduce) { *, *::before, *::after {
  animation-duration: .001ms !important; animation-iteration-count: 1 !important;
  transition-duration: .001ms !important; } }`.
- **Keyframes**: keep `eq`, `spin`; rename `drawer-in` -> `sheet-in` and update
  `.drawer`, `.lyrics`, `.watch__skip` references.
- **View Transitions**: feature-detect `document.startViewTransition` in
  `App.tsx` `go()`. Supported -> wrap the content-swap setters; assign
  `view-transition-name: np-art` (artwork) + `np-title` (title) so the mini
  player expands as a shared element into full-screen now-playing.
  Unsupported -> setters run directly; the now-playing view enters via a CSS
  `sheet-in` slide-up (`transform: translateY(100%) -> 0`), view swaps are
  instant. Both paths respect the reduced-motion guard (instant).
- **No animation library**: `frontend/package.json` gains no
  `framer-motion` / `motion` / `gsap`.

### Decision: PWA sync (slice 1) - exact edits

| File | Edit |
|---|---|
| `frontend/index.html` | `<meta name="theme-color" content="#0E1414">` (dark default) **+ add** `<meta name="theme-color" media="(prefers-color-scheme: light)" content="#F1F4F3">`. Add the anti-FOUC `<script>` in `<head>` before the stylesheet. Swap the Inter `<link>` for one Google Fonts `<link>` loading **Fraunces** (400,500 + italic) and **Hanken Grotesk** (400,500,600,700). Re-evaluate `apple-mobile-web-app-status-bar-style` (keep `black-translucent`; acceptable for both themes with `viewport-fit=cover`). |
| `frontend/public/manifest.webmanifest` | `background_color` `#0b0910` -> `#0E1414`; `theme_color` `#0b0910` -> `#0E1414` (single value drives the splash; dark chosen as brand default). |
| `frontend/public/sw.js` | `const CACHE = "resonar-shell-v1"` -> `"resonar-shell-v2"` (**mandatory** - the `activate` handler purges non-current caches; without the bump installed PWAs keep the old shell/CSS/icons forever). `SHELL` list stays valid. |
| `frontend/public/icon.svg`, `icon-maskable.svg`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png` | Regenerate the brand glyph (currently the `◈` mark in violet, `Sidebar.tsx:26`) in the sage accent **`#6DA89B`**. **Design-asset task, not a build step** - hand-produced/exported PNG+SVG committed to `public/`. |
| `backend/app/routers/settings.py` (l.58-63) | `lastfm_callback` inline HTML `background:#0b0910;color:#f0edf7` -> `#0E1414` / `#E6EDEB`. |
| `SettingsView` toggle (runtime) | On theme change, update the active `theme-color` meta's `content` to `#0E1414` (dark) / `#F1F4F3` (light). |

Type stacks: `--font-display: "Fraunces", Georgia, serif;`
`--font-ui: "Hanken Grotesk", system-ui, -apple-system, "Segoe UI", Roboto,
sans-serif;`. Data/numeric elements get
`font-variant-numeric: tabular-nums`. "Resonance rings" behind the full-screen
artwork = 3 concentric `border` circles with staggered
`@keyframes ring { to { transform: scale(1.6); opacity: 0 } }`, fully removed by
the reduced-motion guard.

### Decision: history persistence mirrors `services/playlists.py`

**`backend/app/services/history.py`** (module functions, no class):

```python
_FILE = os.path.join(settings.data_dir, "history.json")
_lock = threading.Lock()
CAP = 800   # pinned, within the 500-1000 band

def ensure() -> None:
    os.makedirs(settings.data_dir, exist_ok=True)
    if not os.path.exists(_FILE):
        with open(_FILE, "w", encoding="utf-8") as f:
            json.dump({"entries": []}, f)

def _load() -> dict:                      # tolerant -> {"entries": []}
    ensure()
    try:
        with open(_FILE, encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data.get("entries"), list) else {"entries": []}
    except (OSError, json.JSONDecodeError):
        return {"entries": []}

def _save(data: dict) -> None:            # atomic: tmp + os.replace
    ensure()
    tmp = _FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    os.replace(tmp, _FILE)

def add(entry: dict) -> dict:             # dedupe + stamp + cap
    with _lock:
        data = _load()
        entries = data["entries"]
        now = int(time.time())
        vid = entry["videoId"]
        if entries and entries[-1].get("videoId") == vid:      # consecutive repeat
            entries[-1]["playedAt"] = now
            entries[-1]["playCount"] = entries[-1].get("playCount", 1) + 1
            stored = entries[-1]
        else:
            stored = {**entry, "playedAt": now, "playCount": 1}
            entries.append(stored)
        if len(entries) > CAP:                                 # drop oldest
            del entries[: len(entries) - CAP]
        data["entries"] = entries
        _save(data)
        return stored

def list_entries(limit: int | None = None) -> list[dict]:      # newest-first
    entries = list(reversed(_load()["entries"]))
    return entries[:limit] if limit else entries

def clear() -> None:
    with _lock:
        _save({"entries": []})
```

Storage order: appended oldest-last; `list_entries` reverses then slices.
`history.json` shape: `{"entries": [HistoryEntry, ...]}`.

**`backend/app/routers/history.py`** (thin, camelCase bodies, `playlists.py` style):

```python
from typing import Literal
from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from ..services import history

router = APIRouter(tags=["history"])

class HistoryEntry(BaseModel):        # response shape (docs/type parity)
    videoId: str
    title: str
    artist: str | None = None
    thumbnail: str | None = None
    kind: Literal["song", "video"] = "song"
    playedAt: int
    playCount: int = 1
    source: str | None = None

class HistoryBody(BaseModel):         # POST body - no playedAt / playCount
    videoId: str = Field(min_length=1, max_length=64)
    title: str = Field(min_length=1, max_length=500)
    artist: str | None = Field(default=None, max_length=500)
    thumbnail: str | None = Field(default=None, max_length=1000)
    kind: Literal["song", "video"] = "song"
    source: str | None = Field(default=None, max_length=32)

@router.get("/history")
async def get_history(limit: int = Query(100, ge=1, le=800)):
    return {"results": history.list_entries(limit)}

@router.post("/history")
async def post_history(body: HistoryBody):
    return history.add(body.model_dump())

@router.delete("/history")
async def delete_history():
    history.clear()
    return {"ok": True}
```

The `Field(max_length=...)` constraints make a malformed or oversized body a
422 (satisfies "Invalid POST rejected with 4xx" + "Oversized payload rejected").

**`backend/app/main.py` diff**:

```python
from .routers import ( ... history as history_router, recommendations as recs_router, ... )
from .services import ( ... history as history_service, ... )

# in lifespan(), beside playlists_service.ensure():
    history_service.ensure()

# after the other include_router calls:
app.include_router(history_router.router, prefix="/api")
app.include_router(recs_router.router, prefix="/api")
```

### Decision: record on start (not scrobble-threshold gated)

**Choice**: `recordPlay` fires when playback *starts*, not on the >=240s / half
-duration scrobble threshold.

**Rationale**: (a) mirrors `scrobbleNowPlaying`'s "on load" semantics and lives
at the same line; (b) recommendations want the breadth of what the user reaches
for, including skip-heavy discovery, not only completed listens; (c) fire-and
-forget with no retry is cheap and the consecutive-repeat dedupe + `playCount`
already absorb re-plays; (d) threshold gating would mean threading state into
the `timeupdate` / `scrobbledRef` path - more surface, more risk to a
preserved system.

**`frontend/src/api.ts`** (fire-and-forget, `scrobbleNowPlaying` style):

```ts
export function recordPlay(
  item: Track | VideoItem,
  kind: "song" | "video",
  source?: string,
): void {
  const body = kind === "song"
    ? { videoId: (item as Track).id, title: item.title,
        artist: (item as Track).artists?.[0], thumbnail: item.thumbnail, kind, source }
    : { videoId: (item as VideoItem).id, title: item.title,
        artist: (item as VideoItem).uploader, thumbnail: item.thumbnail, kind, source };
  void fetch(`${BASE}/history`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});
}

export function getHistory(limit = 20): Promise<HistoryEntry[]> {
  return getJSON<{ results: HistoryEntry[] }>(`/history?limit=${limit}`)
    .then((r) => r.results).catch(() => []);
}

export function recommendations(limit = 30): Promise<Track[]> {
  return getJSON<{ results: Track[] }>(`/recommendations?limit=${limit}`)
    .then((r) => r.results).catch(() => []);
}
```

Call sites:
- `PlayerBar.tsx` `useEffect([current])` - immediately after
  `scrobbledRef.current = false;` (l.258), unconditionally:
  `recordPlay(current, "song", "player")`.
- `WatchView.tsx` Plyr `play` handler (l.99), beside `claimPlayback("video")`:
  `player.on("play", () => { claimPlayback("video"); recordPlay(video, "video", "watch"); })`.

`source` values this cycle: `"player"` (songs), `"watch"` (videos). Richer
attribution (`search` / `radio` / `playlist` / `home`) is deferred - the field
is optional and forward-compatible.

**`frontend/src/types.ts`** adds:

```ts
export interface HistoryEntry {
  videoId: string; title: string;
  artist?: string | null; thumbnail?: string | null;
  kind: "song" | "video";
  playedAt: number; playCount: number;
  source?: string | null;
}
```

### Decision: recommendations in a new `routers/recommendations.py` + `services/recommend.py`

**Choice**: new router file + a pure-function service module; **not** inline in
`routers/history.py`.

**Alternatives considered**: extend `routers/history.py` - rejected: it would
fatten a CRUD router with async fan-out, SHA-1 hashing, and ranking, mixing two
capabilities and complicating rollback. A `playlists.py`-style stateful service
- rejected: recommendations persist nothing (cache only), so `services/recommend.py`
holds only pure helpers.

**Rationale**: config rule "keep backend router changes thin; put logic in
services". Rollback = delete two files + remove two `include_router` /
`related:` lines.

**Pinned values**: seeds `N = 12` unique newest ids; `ytmusic.related(id, 15)`
per seed; per-call timeout `asyncio.wait_for(..., 4.0)`; ranked result cap
`30`; `recs:v1:{sha1}` TTL `1800s`; `related:{id}` TTL `3600s`.

**`services/recommend.py`**:

```python
def pick_seeds(entries: list[dict], n: int = 12) -> list[str]:
    seen, out = set(), []
    for e in entries:                      # entries are newest-first
        vid = e.get("videoId")
        if vid and vid not in seen:
            seen.add(vid); out.append(vid)
        if len(out) >= n:
            break
    return out

def rank(results_by_seed: dict[str, list[dict]], seed_order: list[str],
         exclude: set[str], cap: int = 30) -> list[dict]:
    freq: dict[str, int] = {}
    best_recency: dict[str, int] = {}
    meta: dict[str, dict] = {}
    for i, seed in enumerate(seed_order):            # i = recency rank, 0 = most recent
        for tr in results_by_seed.get(seed, []):
            tid = tr.get("id")
            if not tid or tid in exclude:
                continue
            freq[tid] = freq.get(tid, 0) + 1
            best_recency[tid] = min(best_recency.get(tid, 1 << 30), i)
            meta.setdefault(tid, tr)
    ordered = sorted(meta.values(),
                     key=lambda t: (-freq[t["id"]], best_recency[t["id"]]))
    return ordered[:cap]
```

**`routers/recommendations.py`**:

```python
import asyncio, hashlib
from fastapi import APIRouter, Query
from ..deps import get_cache
from ..services import history, ytmusic
from ..services.recommend import pick_seeds, rank

router = APIRouter(tags=["recommendations"])

async def _related_cached(video_id: str, cache) -> tuple[str, list[dict]]:
    ck = f"related:{video_id}"
    hit = await cache.get(ck)
    if hit is not None:
        return video_id, hit
    try:
        res = await asyncio.wait_for(ytmusic.related(video_id, 15), timeout=4.0)
    except Exception:
        res = []
    if res:
        await cache.set(ck, res, 3600)
    return video_id, res

@router.get("/recommendations")
async def recommendations(limit: int = Query(30, ge=1, le=50)):
    cache = get_cache()
    entries = history.list_entries(200)
    seeds = pick_seeds(entries, 12)
    if not seeds:                                          # empty history -> home
        return {"results": (await ytmusic.home())[:limit]}
    key = "recs:v1:" + hashlib.sha1(",".join(sorted(seeds)).encode()).hexdigest()
    hit = await cache.get(key)
    if hit is not None:
        return {"results": hit[:limit]}
    pairs = await asyncio.gather(*(_related_cached(s, cache) for s in seeds))
    by_seed = dict(pairs)
    history_ids = {e["videoId"] for e in entries}
    ranked = rank(by_seed, seeds, history_ids, cap=30)
    if not ranked:                                         # total related failure -> home
        return {"results": (await ytmusic.home())[:limit]}
    await cache.set(key, ranked, 1800)
    return {"results": ranked[:limit]}
```

Partial failure degrades naturally: failed seeds contribute `[]`, `rank` still
runs on the rest, response is always `{"results": Track[]}`.

**`routers/search.py` `/api/related` back-fill** (slice 6):

```python
@router.get("/related/{video_id}")
async def related(video_id: str, limit: int = Query(25, ge=1, le=50)):
    cache = get_cache()
    ck = f"related:{video_id}"
    hit = await cache.get(ck)
    if hit is not None:
        return {"results": hit[:limit]}
    res = await ytmusic.related(video_id, limit)
    if res:
        await cache.set(ck, res, 3600)
    return {"results": res}
```

The `related:{id}` entry is keyed by id only (not `limit`); it stores whatever
list first populated it and callers slice to their own `limit`. The
recommendation fan-out and `/api/related` therefore share one cache entry.

### Decision: "For you" + "Recently played" in `SearchView`

Two non-blocking fetches on mount (`recommendations()`, `getHistory(20)`), each
already `.catch(() => [])`. Render order: **"For you"** (recs) above the
existing `homeMusic()` feed, **"Recently played"** below it (both above/around
per the mockup, but "For you" strictly above `homeMusic`). Both render rows
with the **existing `TrackRow`**. `HistoryEntry` -> `TrackRow` adapter:
`{ id: h.videoId, title: h.title, artists: h.artist ? [h.artist] : [],
album: null, duration: "", durationSeconds: 0, thumbnail: h.thumbnail ?? null }`.
Each section is wrapped in `{arr.length > 0 && (<section>...)}` so an empty
result renders **no header and no layout gap**. `kind: "video"` history rows
enqueue as audio for this cycle (routing them into watch is deferred).

## Data Flow

**Record a play (client -> /api -> service -> JSON):**

```
PlayerBar useEffect([current]) / WatchView Plyr "play"
        │  recordPlay(item, kind, source)
        ▼
api.ts  ── POST /api/history {videoId,title,artist?,thumbnail?,kind,source} ──▶ routers/history.py
                                                                                   │ HistoryBody validate (422 on bad/oversized)
                                                                                   ▼ history.add(entry)
                                                        services/history.py:  _lock ▸ _load() ▸
                                                          if entries[-1].videoId == vid: playCount++ , playedAt=now
                                                          else: append {..., playedAt=now, playCount=1}
                                                          if len > 800: drop oldest ▸ _save() atomic (tmp + os.replace)
                                                                                   ▼
                                                                        ./data/history.json  {"entries":[...]}
        ◀──────────────────────── stored HistoryEntry (fire-and-forget; client ignores) ────────────────────────
```

**Recommendations (client -> /api -> service -> ytmusic + cache):**

```
SearchView mount ── GET /api/recommendations?limit=30 ──▶ routers/recommendations.py
   │                                                        │
   │                             history.list_entries(200) ─┼─▶ services/history.py ─▶ history.json
   │                             seeds = pick_seeds(12)
   │                             seeds empty ───────────────┼─▶ ytmusic.home()  ─────────────▶ results
   │                             cache.get("recs:v1:<sha1>")┼─▶ deps.cache (Redis|memory) ─hit─▶ results
   │                             miss: asyncio.gather over 12 seeds
   │                                 cache.get("related:{id}") ─hit─▶ list
   │                                 miss: ytmusic.related(id,15)  [asyncio.wait_for 4s]
   │                                        │  ok  ─▶ cache.set("related:{id}", 3600)
   │                                        └ fail ─▶ []
   │                             rank(by_seed, seeds, exclude=history_ids)[:30]
   │                             ranked empty ─────────────────▶ ytmusic.home()
   │                             cache.set("recs:v1:<sha1>", ranked, 1800)
   ◀────────────── {"results": Track[]}  →  TrackRow ×N ("For you")
   GET /api/history?limit=20  →  {"results": HistoryEntry[]}  →  adapter → TrackRow ×N ("Recently played")
```

## File Changes

| File | Action | Slice | Description |
|---|---|---|---|
| `frontend/src/styles.css` | Modify then Delete | 1, 2 | Token rework + literal promotion + motion tokens + 3-block light/dark + per-theme `--plyr-*`; then removed by the split |
| `frontend/src/styles/index.css` | Create | 2 | Ordered `@import` composition root |
| `frontend/src/styles/{tokens,base,layout,motion}.css` | Create | 2 | Split targets |
| `frontend/src/styles/components/*.css` | Create | 2 | Per-block split targets |
| `frontend/src/main.tsx` | Modify | 2 | `import "./styles/index.css"` |
| `frontend/index.html` | Modify | 1 | Anti-FOUC `<script>`; `theme-color` metas (dark + light media); Fraunces + Hanken Grotesk `<link>` |
| `frontend/src/components/Icon.tsx` | Modify | 1 | `sun`, `moon`, `home` glyphs |
| `frontend/src/components/SettingsView.tsx` | Modify | 1 | Theme toggle UI + runtime `theme-color` update + `resonar:theme` persist (try/catch) |
| `frontend/public/sw.js` | Modify | 1 | `CACHE` `resonar-shell-v1` -> `-v2` (mandatory) |
| `frontend/public/manifest.webmanifest` | Modify | 1 | `background_color` + `theme_color` -> `#0E1414` |
| `frontend/public/icon*.{svg,png}`, `apple-touch-icon.png` | Modify | 1 | 6 icons regenerated in `#6DA89B` (design-asset task) |
| `backend/app/routers/settings.py` | Modify | 1 | `lastfm_callback` inline palette |
| `frontend/src/App.tsx` | Modify | 3 | Grid template per breakpoint; `Nav`; `go()` + `pushState`/`popstate`; `startViewTransition` around content swap; full-screen overlays |
| `frontend/src/components/Sidebar.tsx` -> `Nav.tsx` | Rename + Modify | 3 | Responsive rail / bottom bar, same props + `NAV` |
| `frontend/src/components/PlayerBar.tsx` | Modify | 3, 5 | Restored mobile transport; `data-expanded` full-screen now-playing (same instance); `view-transition-name` on artwork; slice 5: `recordPlay(current,"song","player")` after l.258 |
| `frontend/src/components/WatchView.tsx` | Modify | 3, 5 | Full-screen watch relayout (Plyr controls incl. `pip` untouched); slice 5: `recordPlay(video,"video","watch")` in Plyr `play` |
| `frontend/src/components/QueuePanel.tsx`, `LyricsPanel.tsx` | Modify | 3 | Bottom-sheet behaviour (`sheet-in`) |
| `frontend/src/components/*.tsx` + `styles/components/*.css` | Modify | 4 | Restyle passes (className / CSS only) |
| `frontend/src/api.ts` | Modify | 5, 6 | `recordPlay`, `getHistory`, `recommendations` |
| `frontend/src/types.ts` | Modify | 5 | `HistoryEntry` |
| `frontend/src/components/SearchView.tsx` | Modify | 6 | "For you" + "Recently played" sections |
| `backend/app/services/history.py` | Create | 5 | JSON-file history service (`playlists.py` pattern), `CAP = 800` |
| `backend/app/routers/history.py` | Create | 5 | `GET/POST/DELETE /api/history` + `HistoryEntry` / `HistoryBody` |
| `backend/app/services/recommend.py` | Create | 6 | `pick_seeds`, `rank` (pure) |
| `backend/app/routers/recommendations.py` | Create | 6 | `GET /api/recommendations` fan-out + cache + fallback |
| `backend/app/routers/search.py` | Modify | 6 | `related:{id}` cache (TTL 3600) on `/api/related` |
| `backend/app/main.py` | Modify | 5, 6 | `history_service.ensure()` in lifespan; register both routers |
| `./data/history.json` | Create (runtime) | 5 | Seeded `{"entries": []}` from lifespan; gitignored |

## Interfaces / Contracts

New endpoints (all under `/api`, list responses wrapped `{"results": [...]}`):

| Method | Path | Query | Body | Response |
|---|---|---|---|---|
| `GET` | `/api/history` | `limit` 1..800 (default 100) | - | `{"results": HistoryEntry[]}` newest-first |
| `POST` | `/api/history` | - | `HistoryBody` (camelCase, no `playedAt`/`playCount`) | stored `HistoryEntry` (server-stamped) |
| `DELETE` | `/api/history` | - | - | `{"ok": true}` |
| `GET` | `/api/recommendations` | `limit` 1..50 (default 30) | - | `{"results": Track[]}` (existing `Track` shape) |

`HistoryEntry` / `HistoryBody` / `HistoryEntry` (TS): see the decision blocks
above. `Track` is unchanged and reused for recommendations (no new type).

## Testing Strategy

No runner exists; `strict_tdd: false`. Slices 1-4 verify on the dev server
only. Slices 5-6 SHOULD (recommended, not mandated) introduce tooling.

| Layer | What to test | Approach |
|---|---|---|
| Unit (backend) | `history.add` dedupe / `playCount` / `playedAt` stamp / `CAP` trim; `list_entries` order + `limit`; `pick_seeds` uniqueness+order; `rank` frequency-then-recency + `exclude` | **pytest** + `monkeypatch` `settings.data_dir` to `tmp_path`; `rank` fed hand-built dicts |
| Integration (backend) | `GET/POST/DELETE /api/history` happy path; 422 on missing `videoId` / oversized body; `/api/recommendations` empty-history -> home, total-fail -> home, cache hit skips `related`, `related:{id}` reuse | **pytest** + FastAPI `TestClient`; stub `ytmusic.related` / `ytmusic.home`; `deps.cache = MemoryCache()` |
| Unit / smoke (frontend) | `recordPlay` issues one `POST /api/history` and swallows rejections; `recommendations()` / `getHistory()` resolve `[]` on error; `SearchView` renders no header when both arrays empty; toggling theme writes `resonar:theme` + flips `data-theme` | **Vitest + React Testing Library**; `fetch` mocked |
| Manual (dev server) | Per-slice steps below | `npm run dev` |

Per-slice dev-server verification:

1. **Tokens/motion/theming**: toggle OS scheme (first-visit follows it); Settings
   toggle flips + persists across reload; forced choice beats opposite OS
   setting; DevTools Rendering -> emulate `prefers-reduced-motion` kills motion;
   Network throttle -> first paint already correct theme (no FOUC);
   `rg "#fff|#000|rgba\(0,0,0" src/styles` clean in visible-UI rules; Plyr
   audio + video controls legible in both themes.
2. **Split**: `git diff --stat` shows only moves + `main.tsx` + `index.css`;
   selector-sorted diff empty; visual pass every view x both themes; grep - no
   `className` changed.
3. **Nav**: resize across 860px (only one presentation visible); bottom-nav
   never overlaps content; Back/Forward gesture walks views and closes
   overlays first; audio keeps playing while navigating and while opening
   full-screen now-playing (PlayerBar not remounted - temporarily
   `console.count("PlayerBar mount")`); PiP button present + working in watch;
   MediaSession controls still work from the lock screen.
4. **Restyle**: per-view visual pass, both themes, reduced-motion on.
5. **History**: `curl -XPOST /api/history` (valid / missing `videoId` / huge
   body); play a song then a video; inspect `./data/history.json`; play same
   song twice -> one entry `playCount:2`; A,B,A -> two A entries;
   `curl -XDELETE`; restart backend -> `GET` still returns prior entries;
   `GET ?limit=10` caps + newest-first.
6. **Recs**: empty history -> payload from `home()`; populate 12 seeds ->
   `curl /api/recommendations` cold (multi-second) then warm (fast, no new
   `related` calls); stub a `related` failure -> still `{"results": [...]}`;
   `SearchView` shows "For you" above `homeMusic` and "Recently played";
   both hidden with no gap when empty.

## Migration / Rollout

No data migration. `./data/history.json` is inert runtime data - deletable, no
other service reads it, no schema versioning. Each slice is an independently
revertable PR (see proposal Rollback Plan). Slices 1 and 3 must re-bump
`sw.js` `CACHE` on revert so installed PWAs drop the reverted shell. Native
View Transitions and the resonance-ring animation are progressive enhancements;
absence degrades to instant/sheet with no error.

## Open Questions

- [ ] Bare `:root` = **light** (locked mockup) contradicts the `theme-system`
      spec sentence "dark token set as the default `:root` values". Resolved in
      favour of the mockup; observable behaviour is identical. Flag for spec
      amendment during `sdd-tasks` or archive.
- [ ] `DELETE /api/history/{videoId}` (single-entry removal) - **deferred**;
      only clear-all is in scope this cycle (proposal open question).
- [ ] "Recently played" rows of `kind: "video"` currently enqueue as audio;
      routing them into `WatchView` is deferred to a follow-up.
- [ ] Theme-toggle entry points beyond `SettingsView` (bottom-nav overflow,
      player actions) - **deferred**; `SettingsView` only this cycle.
- [ ] Exact `resonance-ring` timing/scale values and the full-screen
      now-playing layout composition are left to slice 3 implementation within
      the locked motion tokens.
- [ ] `related:{id}` cache ignores `limit` (id-only key). Accepted trade-off;
      revisit only if a caller needs a guaranteed count larger than the cached
      list.
