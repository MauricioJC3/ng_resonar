# Tasks: Redesign and Playback History

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1600-2200 total (slice 1 tokens+PWA ~450, slice 2 split ~900 moved, slice 3 nav+motion ~380, slice 4 restyle ~320, slice 5 history ~230, slice 6 recs ~260) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 -> PR 2 -> PR 3 -> PR 4 -> PR 5 -> PR 6 (one per slice) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Cool/serene tokens + motion tokens + light/dark theming + PWA sync | PR 1 | `rg -n "#fff\|#000\|rgba\(0,\s*0,\s*0" frontend/src/styles.css` (clean in visible-UI rules) | `npm run dev` -> toggle OS scheme, Settings toggle, throttle for FOUC | Revert PR 1, re-bump `sw.js` `CACHE` |
| 2 | Mechanical `styles.css` -> `styles/**` split | PR 2 | `git diff --stat` shows only moves + `main.tsx` + `styles/**` | `npm run dev` side-by-side visual pass, both themes | Revert PR 2 to single `styles.css` + original `main.tsx` import |
| 3 | Responsive Nav + mobile transport + full-screen views + View Transitions + back-button | PR 3 | `npm run dev` -> resize across 860px, back/forward gesture | `npm run dev` + temporary `console.count("PlayerBar mount")` | Revert PR 3, re-bump `sw.js` `CACHE` |
| 4 | Per-view restyle passes (className / component-CSS only) | PR 4 | `npm run dev` per-view visual pass, both themes | `npm run dev`, reduced-motion on/off | Revert PR 4 |
| 5 | Playback history service + router + client `recordPlay` hooks | PR 5 | `pytest backend/tests/test_history_service.py backend/tests/test_history_router.py` | uvicorn dev + `curl` POST/GET/DELETE, inspect `./data/history.json` | Unregister router in `main.py`, delete `services/history.py` + `routers/history.py`, remove `recordPlay` calls + `HistoryEntry` type |
| 6 | Recommendations service + router + `related` cache + "For you" UI | PR 6 | `pytest backend/tests/test_recommend.py backend/tests/test_recommendations_router.py` | uvicorn dev + `curl /api/recommendations` cold then warm | Remove recs router/service, `related:{id}` cache lines, `recommendations()` in `api.ts`, `SearchView` sections |

---

## Slice 1: Design tokens + motion + theming (PR 1)

- [ ] 1.1 In `frontend/src/styles.css` restructure the `:root` block: bare `:root` = full LIGHT token set + `color-scheme: light` + theme-invariant tokens (radii, type, light shadows, light `--plyr-*`); declare `--on-media: #F4F7F6` here once.
- [ ] 1.2 Add Block 2 `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { ... } }` with the dark token overrides + `color-scheme: dark` + dark shadows.
- [ ] 1.3 Add Block 3a `:root[data-theme="dark"]` (verbatim copy of Block 2 body, fenced `/* DARK SET - keep in sync with @media block */`) and Block 3b `:root[data-theme="light"]` re-asserting the light set.
- [ ] 1.4 Populate the locked palette: dark bg `#0E1414`, light bg `#F2F5F4`, accent `#6DA89B`, blue-grey text ramp, diffuse multi-layer shadows; define `--stage-bg`, `--scrim`, `--accent-soft`.
- [ ] 1.5 Add motion tokens: `--dur-fast: 140ms`, `--dur-base: 240ms`, `--dur-slow: 320ms`, `--ease-standard`, `--ease-emphasized`, `--ease-exit`.
- [ ] 1.6 Add a per-theme `--plyr-*` block (light + dark) so Plyr audio/video controls, menu background, and range track resolve from tokens.
- [ ] 1.7 Promote raw literals per the design map: `#fff` -> `var(--on-media)` on `.track__art-play`, `.vcard__dur`, `.vcard__play`, `.srow__play`, `.srow__dur`, `.watch__hd`, `.watch__skip`, `.player__badge`; `#000` -> `var(--stage-bg)` on `.watch__stage`; `rgba(0,0,0,*)` scrims -> `var(--scrim)` (pills may use `color-mix(in srgb, var(--stage-bg) 82%, transparent)`); `#6d28d9` -> `var(--accent-soft)` -> `var(--accent)` in the `.btn--accent` gradient.
- [ ] 1.8 Verify: `rg -n "#fff|#000|rgba\(0,\s*0,\s*0" frontend/src/styles.css` returns nothing inside rules that render visible UI (scrim/keyframe internals excepted).
- [ ] 1.9 Add the anti-FOUC inline `<script>` to `frontend/index.html` `<head>` BEFORE the stylesheet `<link>`: reads `localStorage["resonar:theme"]`, falls back to `matchMedia("(prefers-color-scheme: dark)")`, sets `document.documentElement` `data-theme`, `catch` -> `"dark"`.
- [ ] 1.10 In `frontend/index.html` add `<meta name="theme-color" content="#0E1414">` and `<meta name="theme-color" media="(prefers-color-scheme: light)" content="#F1F4F3">`; keep `apple-mobile-web-app-status-bar-style` `black-translucent`.
- [ ] 1.11 In `frontend/index.html` swap the Inter `<link>` for a Google Fonts `<link>` loading Fraunces (400,500 + italic) and Hanken Grotesk (400,500,600,700); set `--font-display: "Fraunces", Georgia, serif` and `--font-ui: "Hanken Grotesk", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`; add `font-variant-numeric: tabular-nums` to data/numeric elements.
- [ ] 1.12 Add `sun`, `moon`, `home` glyph cases to `frontend/src/components/Icon.tsx`.
- [ ] 1.13 Add a theme toggle to `frontend/src/components/SettingsView.tsx`: read/write `localStorage["resonar:theme"]` in try/catch, set `document.documentElement.dataset.theme`, update the active `theme-color` meta `content` to `#0E1414` (dark) / `#F1F4F3` (light); indicator reflects current theme with `sun`/`moon`.
- [ ] 1.14 Bump `frontend/public/sw.js` `const CACHE = "resonar-shell-v1"` -> `"resonar-shell-v2"` (mandatory); confirm the `SHELL` list stays valid.
- [ ] 1.15 Update `frontend/public/manifest.webmanifest`: `background_color` and `theme_color` `#0b0910` -> `#0E1414`.
- [ ] 1.16 Update `backend/app/routers/settings.py` `lastfm_callback` inline HTML `background:#0b0910;color:#f0edf7` -> `#0E1414` / `#E6EDEB`.
- [ ] 1.17 Design-asset task: regenerate `frontend/public/icon.svg`, `frontend/public/icon-maskable.svg`, `frontend/public/icon-192.png`, `frontend/public/icon-512.png`, `frontend/public/icon-maskable-512.png`, `frontend/public/apple-touch-icon.png` with the brand glyph in `#6DA89B`. If asset generation is unavailable in-session, stub/track separately and note it in the PR - do not block the slice.
- [ ] 1.18 Verify on `npm run dev`: first visit follows OS scheme; Settings toggle flips + persists across reload; a forced choice beats the opposite OS setting; DevTools "emulate `prefers-color-scheme`" both ways; Network throttle -> first painted frame already correct theme (no FOUC); Plyr audio + video controls legible in both themes; DevTools "emulate `prefers-reduced-motion`" leaves theme switching unaffected.

## Slice 2: Mechanical `styles.css` split (PR 2)

- [ ] 2.1 Create `frontend/src/styles/index.css` with ordered `@import`: `./tokens.css`, `./base.css`, `./layout.css`, `./motion.css`, then `./components/{sidebar,track,player,watch,drawer,lyrics,playlist,video,search,settings,buttons,shared}.css`.
- [ ] 2.2 Move the 3-block `:root` + motion tokens + per-theme `--plyr-*` into `frontend/src/styles/tokens.css`, rule bodies byte-identical.
- [ ] 2.3 Move reset, `html`/`body`, typography (Fraunces/Hanken), scrollbars, `::selection` into `frontend/src/styles/base.css`.
- [ ] 2.4 Move `.app` grid, `.main`, `.view*`, responsive shell, `.nav` rules into `frontend/src/styles/layout.css`.
- [ ] 2.5 Move `@keyframes` (`eq`, `spin`, `drawer-in`) + the `prefers-reduced-motion` guard into `frontend/src/styles/motion.css`.
- [ ] 2.6 Move each component block verbatim into its `frontend/src/styles/components/*.css` file (selectors unchanged, no edits).
- [ ] 2.7 Swap `frontend/src/main.tsx` import `./styles.css` -> `./styles/index.css`; delete `frontend/src/styles.css`.
- [ ] 2.8 Verify: `git diff --stat` shows only moved lines + the `main.tsx` import + `styles/**`; a selector-sorted diff of old vs concatenated new is empty; grep the component tree - no `className` string changed.
- [ ] 2.9 Verify on `npm run dev`: side-by-side visual pass on every view in both themes; zero selector / cascade / behaviour change.

## Slice 3: Responsive nav + mobile transport + full-screen views + view transitions + back-button (PR 3)

- [ ] 3.1 Rename `frontend/src/components/Sidebar.tsx` -> `frontend/src/components/Nav.tsx`; keep the same props (`{ view: View; onNavigate: (v: View) => void }`) and the same static `NAV` array (5 items).
- [ ] 3.2 One component, both presentations selected by CSS in `frontend/src/styles/components/sidebar.css`: rail at `>= 860px`; fixed bottom-nav in one `@media (max-width: 859.98px)` block; `.main` padded so the bar never overlaps content.
- [ ] 3.3 Update `frontend/src/App.tsx` `.app` grid: `>= 860px` -> `grid-template-columns: 244px 1fr; grid-template-rows: 1fr 90px; grid-template-areas: "nav main" / "player player"`; `< 860px` -> single column, rows `1fr auto auto`, areas `"main" "player" "nav"`, `.nav { position: sticky; bottom: 0 }`, `.main { padding-bottom: 8px }`.
- [ ] 3.4 Keep `<PlayerBar />` a direct child of `.app` in every layout - never moved into `content`, never given a `key`, never conditionally mounted or wrapped in a component that unmounts on view change.
- [ ] 3.5 Restore the mobile transport/seek control (currently hidden below 900px): play/pause + a seekable progress control visible and operable on mobile viewports, in the mini-player or the full-screen now-playing view.
- [ ] 3.6 Full-screen now-playing = CSS expansion of the already-mounted `PlayerBar` (`data-expanded` / class toggle, optional `createPortal` to `document.body` of the SAME JSX subtree) - not a new component, not a second `<audio>`/Plyr; same `usePlayer()` instance; `position: fixed; inset: 0; z-index` above the bottom-nav.
- [ ] 3.7 Full-screen watch in `frontend/src/components/WatchView.tsx`: `position: fixed; inset: 0` above the bottom-nav on mobile; desktop keeps it in `.main`. Do NOT edit the Plyr `controls` array, do NOT set `display:none` / `visibility:hidden` / `pointer-events:none` on `.plyr__controls` / `.plyr__control`, do NOT replace or duplicate Plyr's container element.
- [ ] 3.8 Set `view-transition-name: np-art` on the existing `.player__art` `<img>` and `np-title` on the now-playing title.
- [ ] 3.9 Add a `go(next)` helper in `frontend/src/App.tsx` wrapping every state transition (`navigate`, `watch`, `setOpenPlaylist`, `onClose` / `onBack`): compute next `{ view, watching, openPlaylist }`, call `history.pushState(nextState, "")`, then apply the setters; wrap ONLY those content-swap setters in `document.startViewTransition` when `typeof document.startViewTransition === "function"`.
- [ ] 3.10 On mount in `App.tsx` call `history.replaceState(currentState, "")` so the first Back has a target.
- [ ] 3.11 Add one `useEffect(() => { window.addEventListener("popstate", onPop); return () => window.removeEventListener("popstate", onPop); }, [])` where `onPop(e)` reads `e.state` (default `{ view: "search", watching: null, openPlaylist: null }` when null) and applies the three setters directly - it does NOT push again.
- [ ] 3.12 Deep-path / refresh: `history.state === null` resolves to `view: "search"` with no overlay (always a valid view; no URL parsing, no `react-router`).
- [ ] 3.13 In `frontend/src/styles/components/*.css` + `frontend/src/styles/motion.css`: rename `drawer-in` -> `sheet-in` and update `.drawer`, `.lyrics`, `.watch__skip` references; add the CSS slide-up sheet fallback for now-playing (`transform: translateY(100%) -> 0`) used when View Transitions are unsupported; replace the ~40 inline durations with `--dur-*` / `--ease-*` tokens per the design search-replace map.
- [ ] 3.14 Give `frontend/src/components/QueuePanel.tsx` and `frontend/src/components/LyricsPanel.tsx` bottom-sheet behaviour driven by the `sheet-in` keyframe.
- [ ] 3.15 Confirm `frontend/package.json` gains no `framer-motion` / `motion` / `gsap`.
- [ ] 3.16 CHECK (preservation) on `npm run dev` with temporary `console.count("PlayerBar mount")`: background audio keeps playing across every view change and while opening/closing full-screen now-playing; `PlayerBar` mounts exactly once at shell level (never remounts).
- [ ] 3.17 CHECK (preservation): MediaSession lock-screen / headset controls (play/pause/prev/next/seek) still work; the `useEffect([current])` body in `PlayerBar.tsx` is unchanged.
- [ ] 3.18 CHECK (preservation): Plyr Picture-in-Picture button present and working in watch; the `controls` array still includes `"pip"` and `"fullscreen"`.
- [ ] 3.19 CHECK (preservation): Web Audio volume-leveling toggle still works (`buildGraph` / `routeGraph` / `toggleLevel` untouched; only `.player__toggle.is-on` styling changed).
- [ ] 3.20 CHECK (preservation): radio auto-extend still fires on the Plyr `ended` event; keyboard shortcuts still work; Last.fm scrobble still fires.
- [ ] 3.21 Verify on `npm run dev`: resize across 860px (only one nav presentation visible at a time); bottom-nav never overlaps content; browser / OS back gesture walks views and closes full-screen overlays first (does not exit the app); reduced-motion emulation makes view swaps and sheet openings instant with no console error.

## Slice 4: Per-view restyle passes (PR 4)

className / component-CSS only - no logic change in any `.tsx`.

- [ ] 4.1 Restyle tracklist + rows in `frontend/src/styles/components/track.css` (+ class-string tweaks only in the tracklist / `TrackRow` components).
- [ ] 4.2 Restyle the player bar in `frontend/src/styles/components/player.css`.
- [ ] 4.3 Restyle the watch view in `frontend/src/styles/components/watch.css` - only `.watch` / `.watch__stage` background + radii token-ised; Plyr controls untouched.
- [ ] 4.4 Restyle queue + lyrics as bottom sheets in `frontend/src/styles/components/drawer.css` and `frontend/src/styles/components/lyrics.css`.
- [ ] 4.5 Restyle playlists in `frontend/src/styles/components/playlist.css`.
- [ ] 4.6 Restyle the video grid + cards in `frontend/src/styles/components/video.css`.
- [ ] 4.7 Restyle search in `frontend/src/styles/components/search.css`.
- [ ] 4.8 Restyle settings in `frontend/src/styles/components/settings.css`.
- [ ] 4.9 Restyle library + empty states in `frontend/src/styles/components/shared.css` (`.hint`, `.empty*`, `.badge*`, `.chip*`, `.spinner`).
- [ ] 4.10 Add "resonance rings" behind the full-screen artwork: 3 concentric `border` circles with staggered `@keyframes ring { to { transform: scale(1.6); opacity: 0 } }` in `frontend/src/styles/motion.css`, fully removed by the reduced-motion guard.
- [ ] 4.11 CHECK (preservation) on `npm run dev`: only class strings / CSS changed (no component logic) - background audio, `PlayerBar` single-mount, MediaSession, Plyr PiP, Web Audio leveling, radio auto-extend, keyboard shortcuts, and scrobble all still work after the restyle.
- [ ] 4.12 Verify on `npm run dev`: per-view visual pass in both light and dark, with reduced-motion on and off.

## Slice 5: Playback history - backend + client hooks (PR 5)

- [ ] 5.1 Create `backend/app/services/history.py` mirroring `services/playlists.py`: `_FILE = os.path.join(settings.data_dir, "history.json")`, `_lock = threading.Lock()`, `CAP = 800`.
- [ ] 5.2 Implement `ensure()` - `os.makedirs(settings.data_dir, exist_ok=True)`, seed `{"entries": []}` when the file is absent.
- [ ] 5.3 Implement `_load()` - tolerant of `OSError` / `json.JSONDecodeError`, returns `{"entries": []}` when the shape is wrong.
- [ ] 5.4 Implement `_save(data)` - atomic write to `_FILE + ".tmp"` then `os.replace`, `json.dump(..., ensure_ascii=False)`.
- [ ] 5.5 Implement `add(entry)` - under `_lock`: if the last entry has the same `videoId`, bump `playedAt = now` and `playCount += 1`; else append `{**entry, "playedAt": now, "playCount": 1}`; drop oldest while `len(entries) > CAP`; return the stored entry.
- [ ] 5.6 Implement `list_entries(limit=None)` - newest-first (`reversed`), slice to `limit` when given.
- [ ] 5.7 Implement `clear()` - under `_lock`, `_save({"entries": []})`.
- [ ] 5.8 Create `backend/app/routers/history.py` (thin, `playlists.py` style): `router = APIRouter(tags=["history"])`, `HistoryEntry` response model, `HistoryBody` POST model with camelCase fields and `Field(min_length/max_length=...)` constraints and no `playedAt` / `playCount`.
- [ ] 5.9 Add handlers in `routers/history.py`: `GET /history` (`limit: int = Query(100, ge=1, le=800)` -> `{"results": history.list_entries(limit)}`); `POST /history` (`body: HistoryBody` -> `history.add(body.model_dump())`); `DELETE /history` (`history.clear()` -> `{"ok": True}`).
- [ ] 5.10 In `backend/app/main.py`: import `history as history_router` and `history as history_service`; call `history_service.ensure()` in `lifespan` beside `playlists_service.ensure()`; `app.include_router(history_router.router, prefix="/api")`.
- [ ] 5.11 Add `data/history.json` to `.gitignore`.
- [ ] 5.12 Add the `HistoryEntry` interface to `frontend/src/types.ts` (`videoId`, `title`, `artist?`, `thumbnail?`, `kind: "song" | "video"`, `playedAt: number`, `playCount: number`, `source?`).
- [ ] 5.13 Add `recordPlay(item, kind, source?)` and `getHistory(limit = 20)` to `frontend/src/api.ts`: `recordPlay` is fire-and-forget `void fetch(\`${BASE}/history\`, { method: "POST", headers: { "Content-Type": "application/json" }, body })...catch(() => {})` with song-vs-video body mapping per design; `getHistory` returns `r.results` with `.catch(() => [])`.
- [ ] 5.14 In `frontend/src/components/PlayerBar.tsx`, inside the `useEffect` on `current`, immediately after `scrobbledRef.current = false;`, call `recordPlay(current, "song", "player")` unconditionally - beside `scrobbleNowPlaying`, NOT inside the `if (scrobblingOn())` gate, NOT replacing either scrobble call.
- [ ] 5.15 In `frontend/src/components/WatchView.tsx`, in the Plyr `play` handler beside `claimPlayback("video")`, call `recordPlay(video, "video", "watch")`.
- [ ] 5.16 Recommended tooling: add pytest + FastAPI `TestClient` as a backend dev dependency and create `backend/tests/test_history_service.py` - `monkeypatch` `settings.data_dir` to `tmp_path`; cover `add` dedupe / `playCount` / `playedAt` stamp / `CAP` trim, `list_entries` order + `limit`, and `clear`.
- [ ] 5.17 Recommended tooling: create `backend/tests/test_history_router.py` with `TestClient` - `GET/POST/DELETE /api/history` happy path; 422 on missing `videoId` / missing `title`; 422 on an oversized body; entry NOT persisted on a 422.
- [ ] 5.18 Verify (uvicorn dev + `curl`): `POST /api/history` valid / missing `videoId` / oversized body; play a song then a video and inspect `./data/history.json`; play the same song twice -> one entry `playCount:2`; A,B,A -> two A entries; `DELETE`; restart the backend -> `GET` still returns prior entries; `GET ?limit=10` caps and is newest-first.
- [ ] 5.19 CHECK (preservation): scrobble still fires from `PlayerBar` (`recordPlay` is beside `scrobbleNowPlaying`, not replacing it); playback is unaffected when the backend is unreachable and no error surfaces.

## Slice 6: Recommendations + related caching + "For you" UI (PR 6)

- [ ] 6.1 Create `backend/app/services/recommend.py` (pure functions, no state): `pick_seeds(entries, n=12)` - the first `n` unique `videoId`s from the newest-first entries.
- [ ] 6.2 In `backend/app/services/recommend.py` add `rank(results_by_seed, seed_order, exclude, cap=30)` - rank by cross-seed frequency then seed recency, skip ids in `exclude`, return the top `cap` `Track` dicts.
- [ ] 6.3 Create `backend/app/routers/recommendations.py`: `router = APIRouter(tags=["recommendations"])` and `_related_cached(video_id, cache)` - check `related:{video_id}` cache, else `asyncio.wait_for(ytmusic.related(video_id, 15), timeout=4.0)` (`except Exception -> []`), `cache.set(ck, res, 3600)` on a non-empty result.
- [ ] 6.4 Add the `GET /recommendations` handler in `routers/recommendations.py` (`limit: int = Query(30, ge=1, le=50)`): `history.list_entries(200)` -> `pick_seeds(entries, 12)`; empty seeds -> `{"results": (await ytmusic.home())[:limit]}`; compute `key = "recs:v1:" + sha1(",".join(sorted(seeds)))` and return `hit[:limit]` on a cache hit; miss -> `asyncio.gather` over seeds, `rank(by_seed, seeds, history_ids, cap=30)`; empty ranked -> `home()` fallback; `cache.set(key, ranked, 1800)`; return `{"results": ranked[:limit]}`.
- [ ] 6.5 In `backend/app/routers/search.py` add a `related:{id}` cache (TTL 3600s, id-only key) to the `/api/related` handler - cache lookup before `ytmusic.related`, `cache.set` on a non-empty result, callers slice to their own `limit`.
- [ ] 6.6 In `backend/app/main.py` import `recommendations as recs_router` and `app.include_router(recs_router.router, prefix="/api")`.
- [ ] 6.7 Add `recommendations(limit = 30)` to `frontend/src/api.ts` - `getJSON<{ results: Track[] }>(\`/recommendations?limit=${limit}\`).then((r) => r.results).catch(() => [])`.
- [ ] 6.8 In `frontend/src/components/SearchView.tsx`: two non-blocking fetches on mount (`recommendations()`, `getHistory(20)`); render a "For you" section strictly above the existing `homeMusic()` feed and a "Recently played" section, both via the existing `TrackRow`; use the `HistoryEntry` -> `TrackRow` adapter from the design; wrap each section in `{arr.length > 0 && (<section>...</section>)}` so an empty result renders no header and no layout gap.
- [ ] 6.9 Recommended tooling: create `backend/tests/test_recommend.py` - `pick_seeds` uniqueness + order + cap; `rank` frequency-then-recency ordering + `exclude` filtering, on hand-built dicts.
- [ ] 6.10 Recommended tooling: create `backend/tests/test_recommendations_router.py` with `TestClient` + `deps.cache = MemoryCache()`, stubbing `ytmusic.related` / `ytmusic.home` - empty history -> home; total related failure -> home; cache hit skips `related`; `related:{id}` reused by the fan-out; partial failure still returns `{"results": [...]}`.
- [ ] 6.11 Verify (uvicorn dev + `curl`): empty history -> payload from `home()`; populate 12 seeds -> `curl /api/recommendations` cold (multi-second) then warm (fast, no new `related` calls); stub a `related` failure -> still `{"results": [...]}`; `/api/related/{id}` second call within 3600s served from cache.
- [ ] 6.12 Verify on `npm run dev`: `SearchView` shows "For you" above `homeMusic` and "Recently played"; both hidden with no layout gap when empty; rows render through `TrackRow`.
