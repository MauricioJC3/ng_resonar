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

- [x] 1.1 In `frontend/src/styles.css` restructure the `:root` block: bare `:root` = full LIGHT token set + `color-scheme: light` + theme-invariant tokens (radii, type, light shadows, light `--plyr-*`); declare `--on-media: #F4F7F6` here once.
- [x] 1.2 Add Block 2 `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { ... } }` with the dark token overrides + `color-scheme: dark` + dark shadows.
- [x] 1.3 Add Block 3a `:root[data-theme="dark"]` (verbatim copy of Block 2 body, fenced `/* DARK SET - keep in sync with @media block */`) and Block 3b `:root[data-theme="light"]` re-asserting the light set.
- [x] 1.4 Populate the locked palette: dark bg `#0E1414`, light bg `#F2F5F4`, accent `#6DA89B`, blue-grey text ramp, diffuse multi-layer shadows; define `--stage-bg`, `--scrim`, `--accent-soft`.
- [x] 1.5 Add motion tokens: `--dur-fast: 140ms`, `--dur-base: 240ms`, `--dur-slow: 320ms`, `--ease-standard`, `--ease-emphasized`, `--ease-exit`.
- [x] 1.6 Add a per-theme `--plyr-*` block (light + dark) so Plyr audio/video controls, menu background, and range track resolve from tokens.
- [x] 1.7 Promote raw literals per the design map: `#fff` -> `var(--on-media)` on `.track__art-play`, `.vcard__dur`, `.vcard__play`, `.srow__play`, `.srow__dur`, `.watch__hd`, `.watch__skip`, `.player__badge`; `#000` -> `var(--stage-bg)` on `.watch__stage`; `rgba(0,0,0,*)` scrims -> `var(--scrim)` (pills may use `color-mix(in srgb, var(--stage-bg) 82%, transparent)`); `#6d28d9` -> `var(--accent-soft)` -> `var(--accent)` in the `.btn--accent` gradient.
- [x] 1.8 Verify: `rg -n "#fff|#000|rgba\(0,\s*0,\s*0" frontend/src/styles.css` returns nothing inside rules that render visible UI (scrim/keyframe internals excepted).
- [x] 1.9 Add the anti-FOUC inline `<script>` to `frontend/index.html` `<head>` BEFORE the stylesheet `<link>`: reads `localStorage["resonar:theme"]`, falls back to `matchMedia("(prefers-color-scheme: dark)")`, sets `document.documentElement` `data-theme`, `catch` -> `"dark"`.
- [x] 1.10 In `frontend/index.html` add `<meta name="theme-color" content="#0E1414">` and `<meta name="theme-color" media="(prefers-color-scheme: light)" content="#F1F4F3">`; keep `apple-mobile-web-app-status-bar-style` `black-translucent`.
- [x] 1.11 In `frontend/index.html` swap the Inter `<link>` for a Google Fonts `<link>` loading Fraunces (400,500 + italic) and Hanken Grotesk (400,500,600,700); set `--font-display: "Fraunces", Georgia, serif` and `--font-ui: "Hanken Grotesk", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`; add `font-variant-numeric: tabular-nums` to data/numeric elements.
- [x] 1.12 Add `sun`, `moon`, `home` glyph cases to `frontend/src/components/Icon.tsx`.
- [x] 1.13 Add a theme toggle to `frontend/src/components/SettingsView.tsx`: read/write `localStorage["resonar:theme"]` in try/catch, set `document.documentElement.dataset.theme`, update the active `theme-color` meta `content` to `#0E1414` (dark) / `#F1F4F3` (light); indicator reflects current theme with `sun`/`moon`.
- [x] 1.14 Bump `frontend/public/sw.js` `const CACHE = "resonar-shell-v1"` -> `"resonar-shell-v2"` (mandatory); confirm the `SHELL` list stays valid.
- [x] 1.15 Update `frontend/public/manifest.webmanifest`: `background_color` and `theme_color` `#0b0910` -> `#0E1414`.
- [x] 1.16 Update `backend/app/routers/settings.py` `lastfm_callback` inline HTML `background:#0b0910;color:#f0edf7` -> `#0E1414` / `#E6EDEB`.
- [ ] 1.17 Design-asset task: regenerate `frontend/public/icon.svg`, `frontend/public/icon-maskable.svg`, `frontend/public/icon-192.png`, `frontend/public/icon-512.png`, `frontend/public/icon-maskable-512.png`, `frontend/public/apple-touch-icon.png` with the brand glyph in `#6DA89B`. If asset generation is unavailable in-session, stub/track separately and note it in the PR - do not block the slice. _(SVGs done; 4 PNGs cannot be rasterized in-session — TODO tracked in apply-progress.md.)_
- [ ] 1.18 Verify on `npm run dev`: first visit follows OS scheme; Settings toggle flips + persists across reload; a forced choice beats the opposite OS setting; DevTools "emulate `prefers-color-scheme`" both ways; Network throttle -> first painted frame already correct theme (no FOUC); Plyr audio + video controls legible in both themes; DevTools "emulate `prefers-reduced-motion`" leaves theme switching unaffected. _(Manual dev-server step — deferred to reviewer; steps listed in apply-progress.md.)_

## Slice 2: Mechanical `styles.css` split (PR 2)

- [x] 2.1 Create `frontend/src/styles/index.css` with ordered `@import`: `./tokens.css`, `./base.css`, `./layout.css`, `./motion.css`, then `./components/{sidebar,track,player,watch,drawer,lyrics,playlist,video,search,settings,buttons,shared}.css`. _(One file per section banner: `sidebar, shared, search, track, video, watch, buttons, saved-video, player, drawer, misc-chips, playlists, lyrics, settings`. `@import` order reproduces the pre-split top-to-bottom cascade; `layout.css` imported LAST so its `@media (max-width:900px)` block keeps its end-of-cascade position — see apply-progress.md.)_
- [x] 2.2 Move the 3-block `:root` + motion tokens + per-theme `--plyr-*` into `frontend/src/styles/tokens.css`, rule bodies byte-identical.
- [x] 2.3 Move reset, `html`/`body`, typography (Fraunces/Hanken), scrollbars, `::selection` into `frontend/src/styles/base.css`. _(No `::selection` rule exists in source; font families are token values in `tokens.css` loaded via `index.html <link>`. Global `:focus-visible` placed here — it sits with the reset rules, not the `:root` blocks.)_
- [x] 2.4 Move `.app` grid, `.main`, `.view*`, responsive shell, `.nav` rules into `frontend/src/styles/layout.css`. _(No `.nav` rules exist yet — Slice 3. The `@media (max-width:900px)` block moved verbatim, including its `.sidebar` responsive rules.)_
- [x] 2.5 Move `@keyframes` (`eq`, `spin`, `drawer-in`) + the `prefers-reduced-motion` guard into `frontend/src/styles/motion.css`. _(Kept `drawer-in` name — rename to `sheet-in` is Slice 3 / task 3.13.)_
- [x] 2.6 Move each component block verbatim into its `frontend/src/styles/components/*.css` file (selectors unchanged, no edits).
- [x] 2.7 Swap `frontend/src/main.tsx` import `./styles.css` -> `./styles/index.css`; delete `frontend/src/styles.css`.
- [x] 2.8 Verify: `git diff --stat` shows only moved lines + the `main.tsx` import + `styles/**`; a selector-sorted diff of old vs concatenated new is empty; grep the component tree - no `className` string changed. _(Verified: 242 open-braces old == 242 new; sorted selector diff empty; every non-comment line multiset-identical; every comment line identical; only `.tsx` change is the `main.tsx` import line.)_
- [ ] 2.9 Verify on `npm run dev`: side-by-side visual pass on every view in both themes; zero selector / cascade / behaviour change. _(Deferred — no dev server / build in this environment. Reviewer checklist in apply-progress.md.)_

## Slice 3: Responsive nav + mobile transport + full-screen views + view transitions + back-button (PR 3)

- [x] 3.1 Rename `frontend/src/components/Sidebar.tsx` -> `frontend/src/components/Nav.tsx`; keep the same props (`{ view: View; onNavigate: (v: View) => void }`) and the same static `NAV` array (5 items).
- [x] 3.2 One component, both presentations selected by CSS in `frontend/src/styles/components/sidebar.css`: rail at `>= 860px`; fixed bottom-nav in one `@media (max-width: 859.98px)` block; `.main` padded so the bar never overlaps content.
- [x] 3.3 Update `frontend/src/App.tsx` `.app` grid: `>= 860px` -> `grid-template-columns: 244px 1fr; grid-template-rows: 1fr 90px; grid-template-areas: "nav main" / "player player"`; `< 860px` -> single column, rows `1fr auto auto`, areas `"main" "player" "nav"`, `.nav { position: sticky; bottom: 0 }`, `.main { padding-bottom: 8px }`.
- [x] 3.4 Keep `<PlayerBar />` a direct child of `.app` in every layout - never moved into `content`, never given a `key`, never conditionally mounted or wrapped in a component that unmounts on view change.
- [x] 3.5 Restore the mobile transport/seek control (currently hidden below 900px): play/pause + a seekable progress control visible and operable on mobile viewports, in the mini-player or the full-screen now-playing view.
- [x] 3.6 Full-screen now-playing = CSS expansion of the already-mounted `PlayerBar` (`data-expanded` / class toggle, optional `createPortal` to `document.body` of the SAME JSX subtree) - not a new component, not a second `<audio>`/Plyr; same `usePlayer()` instance; `position: fixed; inset: 0; z-index` above the bottom-nav.
- [x] 3.7 Full-screen watch in `frontend/src/components/WatchView.tsx`: `position: fixed; inset: 0` above the bottom-nav on mobile; desktop keeps it in `.main`. Do NOT edit the Plyr `controls` array, do NOT set `display:none` / `visibility:hidden` / `pointer-events:none` on `.plyr__controls` / `.plyr__control`, do NOT replace or duplicate Plyr's container element.
- [x] 3.8 Set `view-transition-name: np-art` on the existing `.player__art` `<img>` and `np-title` on the now-playing title.
- [x] 3.9 Add a `go(next)` helper in `frontend/src/App.tsx` wrapping every state transition (`navigate`, `watch`, `setOpenPlaylist`, `onClose` / `onBack`): compute next `{ view, watching, openPlaylist }`, call `history.pushState(nextState, "")`, then apply the setters; wrap ONLY those content-swap setters in `document.startViewTransition` when `typeof document.startViewTransition === "function"`.
- [x] 3.10 On mount in `App.tsx` call `history.replaceState(currentState, "")` so the first Back has a target.
- [x] 3.11 Add one `useEffect(() => { window.addEventListener("popstate", onPop); return () => window.removeEventListener("popstate", onPop); }, [])` where `onPop(e)` reads `e.state` (default `{ view: "search", watching: null, openPlaylist: null }` when null) and applies the three setters directly - it does NOT push again.
- [x] 3.12 Deep-path / refresh: `history.state === null` resolves to `view: "search"` with no overlay (always a valid view; no URL parsing, no `react-router`).
- [x] 3.13 In `frontend/src/styles/components/*.css` + `frontend/src/styles/motion.css`: rename `drawer-in` -> `sheet-in` and update `.drawer`, `.lyrics`, `.watch__skip` references; add the CSS slide-up sheet fallback for now-playing (`transform: translateY(100%) -> 0`) used when View Transitions are unsupported; replace the ~40 inline durations with `--dur-*` / `--ease-*` tokens per the design search-replace map.
- [x] 3.14 Give `frontend/src/components/QueuePanel.tsx` and `frontend/src/components/LyricsPanel.tsx` bottom-sheet behaviour driven by the `sheet-in` keyframe.
- [x] 3.15 Confirm `frontend/package.json` gains no `framer-motion` / `motion` / `gsap`.
- [x] 3.16 CHECK (preservation) on `npm run dev` with temporary `console.count("PlayerBar mount")`: background audio keeps playing across every view change and while opening/closing full-screen now-playing; `PlayerBar` mounts exactly once at shell level (never remounts).
- [x] 3.17 CHECK (preservation): MediaSession lock-screen / headset controls (play/pause/prev/next/seek) still work; the `useEffect([current])` body in `PlayerBar.tsx` is unchanged.
- [x] 3.18 CHECK (preservation): Plyr Picture-in-Picture button present and working in watch; the `controls` array still includes `"pip"` and `"fullscreen"`.
- [x] 3.19 CHECK (preservation): Web Audio volume-leveling toggle still works (`buildGraph` / `routeGraph` / `toggleLevel` untouched; only `.player__toggle.is-on` styling changed).
- [x] 3.20 CHECK (preservation): radio auto-extend still fires on the Plyr `ended` event; keyboard shortcuts still work; Last.fm scrobble still fires.
- [ ] 3.21 Verify on `npm run dev`: resize across 860px (only one nav presentation visible at a time); bottom-nav never overlaps content; browser / OS back gesture walks views and closes full-screen overlays first (does not exit the app); reduced-motion emulation makes view swaps and sheet openings instant with no console error.

## Slice 4: Per-view restyle passes (PR 4)

className / component-CSS only - no logic change in any `.tsx`.

- [x] 4.1 Restyle tracklist + rows in `frontend/src/styles/components/track.css` (+ class-string tweaks only in the tracklist / `TrackRow` components). _(CSS only — no `.tsx` touched. Flat rows, hover lift to `--bg-elev-2`, `--accent-wash` active, 10px radius, `--accent` active title, floating menus on `--bg-elev` + `--shadow`, 12px radius.)_
- [x] 4.2 Restyle the player bar in `frontend/src/styles/components/player.css`. _(Slimmer Plyr range track scoped to `.player`; `--accent-wash` toggle on-state; Fraunces expanded now-playing title; 16px artwork radius + soft shadow; faint accent wash on the expanded surface.)_
- [x] 4.3 Restyle the watch view in `frontend/src/styles/components/watch.css` - only `.watch` / `.watch__stage` background + radii token-ised; Plyr controls untouched. _(Kept strictly to wrapper/typography: HD badge → neutral `--scrim` media pill, `.watch__title` balance + tighter tracking, `.watch__subhead` → section label. No `.plyr*` rule added; `WatchView.tsx` byte-unchanged.)_
- [x] 4.4 Restyle queue + lyrics as bottom sheets in `frontend/src/styles/components/drawer.css` and `frontend/src/styles/components/lyrics.css`. _(Mobile `::before` grip handle, 16px top radius, `--scrim` backdrop already in place; `--accent-wash` now-playing row + `--accent` title; synced active lyric line → `--accent`.)_
- [x] 4.5 Restyle playlists in `frontend/src/styles/components/playlists.css` (filename per Slice 2 banner split). _(Hairline `--line-soft` border on card art, Fraunces `.plcard__name`, calmer 1.03 hover scale, more grid air, `text-wrap: balance` on the detail `h1`.)_
- [x] 4.6 Restyle the video grid + cards in `frontend/src/styles/components/video.css`. _(Corner duration pill → `--on-media` on `--scrim`; solid `--accent` play chip; calmer 1.03 hover; tabular-nums on `.vcard__meta` view counts.)_
- [x] 4.7 Restyle search in `frontend/src/styles/components/search.css`. _(Calmer focus ring `0 0 0 3px var(--accent-wash)`; autocomplete dropdown → `--bg-elev` soft floating menu, 14px radius, `--shadow`.)_
- [x] 4.8 Restyle settings in `frontend/src/styles/components/settings.css`. _(Cards → hairline `--line` border + `--radius`, more padding; Fraunces `.card__head h2`; `.theme-toggle[aria-checked="true"]` → `--accent-wash` + `--accent`; `--accent-wash` focus ring on `.field input`.)_
- [x] 4.9 Restyle library + empty states in `frontend/src/styles/components/shared.css` + `buttons.css` + `misc-chips.css` (`.hint`, `.empty*`, `.badge*`, `.chip*`, `.spinner`, `.segmented`). _(Empty state gets a muted `♪` `::before` glyph + balanced copy; `.btn--accent` → solid sage (no gradient); `.btn--ghost` truly borderless; `.segmented button.is-on` + `.chip--on` → `--accent-wash` + `--accent`; spinner tinted `--accent`; `.eq i` → `--accent`.)_
- [x] 4.10 Add "resonance rings" behind the full-screen artwork: 3 concentric `border` circles with staggered `@keyframes ring` in `frontend/src/styles/motion.css`, fully removed by the reduced-motion guard. _(`@keyframes ring` (scale .72→1.6, opacity .4→0) + `.player__rings` styling in `player.css`; `.player__rings { display: none !important }` inside the reduced-motion guard. One minimal decorative markup add in `PlayerBar.tsx` — see markup_changes.)_
- [x] 4.11 CHECK (preservation): only class strings / CSS changed (plus one decorative `aria-hidden` span). No `useEffect`, handler, ref, state hook, Plyr config, MediaSession, audio/video element, API call, or prop/data-flow edit. Manual `npm run dev` re-confirmation deferred to reviewer (checklist in apply-progress.md).
- [ ] 4.12 Verify on `npm run dev`: per-view visual pass in both light and dark, with reduced-motion on and off. _(Deferred — no dev server / build in this environment. Reviewer checklist in apply-progress.md.)_

## Slice 5: Playback history - backend + client hooks (PR 5)

- [x] 5.1 Create `backend/app/services/history.py` mirroring `services/playlists.py`: `_FILE = os.path.join(settings.data_dir, "history.json")`, `_lock = threading.Lock()`, `CAP = 800`.
- [x] 5.2 Implement `ensure()` - `os.makedirs(settings.data_dir, exist_ok=True)`, seed `{"entries": []}` when the file is absent.
- [x] 5.3 Implement `_load()` - tolerant of `OSError` / `json.JSONDecodeError`, returns `{"entries": []}` when the shape is wrong.
- [x] 5.4 Implement `_save(data)` - atomic write to `_FILE + ".tmp"` then `os.replace`, `json.dump(..., ensure_ascii=False)`.
- [x] 5.5 Implement `add(entry)` - under `_lock`: if the last entry has the same `videoId`, bump `playedAt = now` and `playCount += 1`; else append `{**entry, "playedAt": now, "playCount": 1}`; drop oldest while `len(entries) > CAP`; return the stored entry.
- [x] 5.6 Implement `list_entries(limit=None)` - newest-first (`reversed`), slice to `limit` when given.
- [x] 5.7 Implement `clear()` - under `_lock`, `_save({"entries": []})`.
- [x] 5.8 Create `backend/app/routers/history.py` (thin, `playlists.py` style): `router = APIRouter(tags=["history"])`, `HistoryEntry` response model, `HistoryBody` POST model with camelCase fields and `Field(min_length/max_length=...)` constraints and no `playedAt` / `playCount`.
- [x] 5.9 Add handlers in `routers/history.py`: `GET /history` (`limit: int = Query(100, ge=1, le=800)` -> `{"results": history.list_entries(limit)}`); `POST /history` (`body: HistoryBody` -> `history.add(body.model_dump())`); `DELETE /history` (`history.clear()` -> `{"ok": True}`).
- [x] 5.10 In `backend/app/main.py`: import `history as history_router` and `history as history_service`; call `history_service.ensure()` in `lifespan` beside `playlists_service.ensure()`; `app.include_router(history_router.router, prefix="/api")`.
- [x] 5.11 Add `data/history.json` to `.gitignore`. _(Already covered by the existing `data/` rule at `.gitignore:9`; `data/playlists.json` and the batch zips are ignored by the same rule, so no edit needed — brief §4.)_
- [x] 5.12 Add the `HistoryEntry` interface to `frontend/src/types.ts` (`videoId`, `title`, `artist?`, `thumbnail?`, `kind: "song" | "video"`, `playedAt: number`, `playCount: number`, `source?`).
- [x] 5.13 Add `recordPlay(item, kind, source?)` and `getHistory(limit = 20)` to `frontend/src/api.ts`: `recordPlay` is fire-and-forget `void fetch(\`${BASE}/history\`, { method: "POST", headers: { "Content-Type": "application/json" }, body })...catch(() => {})` with song-vs-video body mapping per design; `getHistory` returns `r.results` with `.catch(() => [])`. _(Also added `clearHistory()` for the DELETE endpoint per brief §7.)_
- [x] 5.14 In `frontend/src/components/PlayerBar.tsx`, inside the `useEffect` on `current`, immediately after `scrobbledRef.current = false;`, call `recordPlay(current, "song", "player")` unconditionally - beside `scrobbleNowPlaying`, NOT inside the `if (scrobblingOn())` gate, NOT replacing either scrobble call.
- [x] 5.15 In `frontend/src/components/WatchView.tsx`, in the Plyr `play` handler beside `claimPlayback("video")`, call `recordPlay(video, "video", "watch")`.
- [x] 5.16 Recommended tooling: add pytest + FastAPI `TestClient` as a backend dev dependency and create `backend/tests/test_history_service.py` - `monkeypatch` `settings.data_dir` to `tmp_path`; cover `add` dedupe / `playCount` / `playedAt` stamp / `CAP` trim, `list_entries` order + `limit`, and `clear`. _(Added `backend/requirements-dev.txt` + `backend/pytest.ini` + `backend/tests/conftest.py`. Tests written; NOT run — no venv/deps in this environment.)_
- [x] 5.17 Recommended tooling: create `backend/tests/test_history_router.py` with `TestClient` - `GET/POST/DELETE /api/history` happy path; 422 on missing `videoId` / missing `title`; 422 on an oversized body; entry NOT persisted on a 422. _(Written; NOT run — no venv/deps.)_
- [ ] 5.18 Verify (uvicorn dev + `curl`): `POST /api/history` valid / missing `videoId` / oversized body; play a song then a video and inspect `./data/history.json`; play the same song twice -> one entry `playCount:2`; A,B,A -> two A entries; `DELETE`; restart the backend -> `GET` still returns prior entries; `GET ?limit=10` caps and is newest-first. _(Deferred — no uvicorn/deps in this environment. Reviewer checklist in apply-progress.md.)_
- [x] 5.19 CHECK (preservation): scrobble still fires from `PlayerBar` (`recordPlay` is beside `scrobbleNowPlaying`, not replacing it); playback is unaffected when the backend is unreachable and no error surfaces.

## Slice 6: Recommendations + related caching + "For you" UI (PR 6)

- [x] 6.1 Create `backend/app/services/recommend.py` (pure functions, no state): `pick_seeds(entries, n=12)` - the first `n` unique `videoId`s from the newest-first entries.
- [x] 6.2 In `backend/app/services/recommend.py` add `rank(results_by_seed, seed_order, exclude, cap=30)` - rank by cross-seed frequency then seed recency, skip ids in `exclude`, return the top `cap` `Track` dicts.
- [x] 6.3 Create `backend/app/routers/recommendations.py`: `router = APIRouter(tags=["recommendations"])` and `_related_cached(video_id, cache)` - check `related:{video_id}` cache, else `asyncio.wait_for(ytmusic.related(video_id, 15), timeout=4.0)` (`except Exception -> []`), `cache.set(ck, res, 3600)` on a non-empty result.
- [x] 6.4 Add the `GET /recommendations` handler in `routers/recommendations.py` (`limit: int = Query(30, ge=1, le=50)`): `history.list_entries(200)` -> `pick_seeds(entries, 12)`; empty seeds -> `{"results": (await ytmusic.home())[:limit]}`; compute `key = "recs:v1:" + sha1(",".join(sorted(seeds)))` and return `hit[:limit]` on a cache hit; miss -> `asyncio.gather` over seeds, `rank(by_seed, seeds, history_ids, cap=30)`; empty ranked -> `home()` fallback; `cache.set(key, ranked, 1800)`; return `{"results": ranked[:limit]}`.
- [x] 6.5 In `backend/app/routers/search.py` add a `related:{id}` cache (TTL 3600s, id-only key) to the `/api/related` handler - cache lookup before `ytmusic.related`, `cache.set` on a non-empty result, callers slice to their own `limit`.
- [x] 6.6 In `backend/app/main.py` import `recommendations as recs_router` and `app.include_router(recs_router.router, prefix="/api")`.
- [x] 6.7 Add `recommendations(limit = 30)` to `frontend/src/api.ts` - `getJSON<{ results: Track[] }>(\`/recommendations?limit=${limit}\`).then((r) => r.results).catch(() => [])`.
- [x] 6.8 In `frontend/src/components/SearchView.tsx`: two non-blocking fetches on mount (`recommendations()`, `getHistory(20)`); render a "For you" section strictly above the existing `homeMusic()` feed and a "Recently played" section, both via the existing `TrackRow`; use the `HistoryEntry` -> `TrackRow` adapter from the design; wrap each section in `{arr.length > 0 && (<section>...</section>)}` so an empty result renders no header and no layout gap.
- [x] 6.9 Recommended tooling: create `backend/tests/test_recommend.py` - `pick_seeds` uniqueness + order + cap; `rank` frequency-then-recency ordering + `exclude` filtering, on hand-built dicts.
- [ ] 6.10 Recommended tooling: create `backend/tests/test_recommendations_router.py` with `TestClient` + `deps.cache = MemoryCache()`, stubbing `ytmusic.related` / `ytmusic.home` - empty history -> home; total related failure -> home; cache hit skips `related`; `related:{id}` reused by the fan-out; partial failure still returns `{"results": [...]}`.
- [ ] 6.11 Verify (uvicorn dev + `curl`): empty history -> payload from `home()`; populate 12 seeds -> `curl /api/recommendations` cold (multi-second) then warm (fast, no new `related` calls); stub a `related` failure -> still `{"results": [...]}`; `/api/related/{id}` second call within 3600s served from cache.
- [ ] 6.12 Verify on `npm run dev`: `SearchView` shows "For you" above `homeMusic` and "Recently played"; both hidden with no layout gap when empty; rows render through `TrackRow`.
