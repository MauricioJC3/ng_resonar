# Proposal: Redesign and Playback History

## Intent

The current UI is a single dark-violet theme with a hard, high-contrast feel, a
desktop-only sidebar, and a mobile layout that hides the transport/seek control
below 900px. Resonar also forgets everything the user plays and offers no
personalised discovery. Goals:

- A softer, calmer, distinctive-but-pleasant look ("cool & serene": ceramic,
  mist, calm), with switchable light + dark themes.
- Navigation that works on a phone (bottom-nav, full-screen now-playing/watch,
  restored mobile transport).
- Remember recently played tracks and surface "For you" recommendations.
- Keep the `/api/*` contract clean and framework-agnostic — a native mobile app
  is planned and will consume the same backend.

## Scope

### In Scope

Delivered as ~6 chained, independently reviewable slices:

1. **Design tokens + motion layer + `data-theme` theming.** Rework the `:root`
   token block to the cool/serene palette (dark bg `~#0E1414`, light bg
   `~#F2F5F4`, sage-teal accent `~#6DA89B`, blue-grey text ramp, diffuse
   multi-layer shadows). Promote the ~25 raw color literals (`#fff`, `#000`,
   `rgba(0,0,0,*)`, `#6d28d9`) to tokens. Add `--dur-*`/`--ease-*` tokens
   (220–320ms band, gentle easing). Add `[data-theme="light"]` overrides,
   per-theme `--plyr-*` block, and `color-scheme`. Theme choice: `data-theme` on
   `<html>`, `prefers-color-scheme` as default, choice remembered in
   `resonar:theme`, pre-paint inline `<head>` script to prevent FOUC. Toggle UI
   in `SettingsView` plus `sun`/`moon` glyphs in `Icon`.

2. **Mechanical `styles.css` split.** Move the 1702-line file into
   `src/styles/{tokens,base,layout,motion}.css` + `src/styles/components/*.css`,
   composed via ordered `@import` from `src/styles/index.css`. Swap the
   `main.tsx` import. No selector, cascade, or behaviour change.

3. **Responsive navigation + mobile transport + full-screen views + view
   transitions.** `Sidebar` becomes a `Nav` that renders as a left rail on
   desktop and a fixed bottom-nav on mobile, on the existing `App.tsx` view-state
   model (no react-router). Now-playing and watch render full-screen on mobile.
   Restore the mobile transport/seek control hidden below 900px. Add a CSS motion
   system (`@keyframes`, `prefers-reduced-motion` guard) and native View
   Transitions for view swaps and the now-playing shared-element expand, with a
   slide-up sheet fallback. No animation library.

4. **Per-view restyle passes.** Apply the new aesthetic across the components
   (tracklist, player bar, watch, queue/lyrics sheets, playlists, video grid,
   settings) — className and component-CSS changes only, no logic changes.

5. **Playback history (backend-persisted).** New
   `backend/app/services/history.py` + `backend/app/routers/history.py`
   mirroring `services/playlists.py` (module functions, `threading.Lock`, atomic
   `_save` via `os.replace`, `ensure()` wired into `main.py` lifespan). File
   `./data/history.json`. `GET /api/history?limit=`, `POST /api/history`,
   `DELETE /api/history` (clear). Cap ~500–1000 entries; consecutive-repeat
   dedupe bumps `playedAt` + `playCount` instead of appending. `HistoryEntry`:
   `videoId, title, artist?, thumbnail?, kind(song|video), playedAt(epoch s),
   playCount, source?`. New fire-and-forget `recordPlay(item, kind, source?)` in
   `frontend/src/api.ts`, called from `PlayerBar.tsx` (`useEffect` on `current`,
   beside `scrobbleNowPlaying`) and `WatchView.tsx` (Plyr `player.on("play")`).
   Record on start.

6. **Recommendations + `related` caching + "For you" UI.**
   `GET /api/recommendations?limit=` returns `{"results": Track[]}`. Strategy:
   fan out the last 10–15 unique history seeds through `ytmusic.related(id,
   limit=15)` concurrently, drop history items, rank by cross-seed frequency then
   seed recency, top ~30. Cache the ranked result in `deps.cache`
   (`recs:v1:{hash}`, TTL 1800s) and add a per-seed `related:{id}` cache
   (TTL 3600s) to the currently-uncached `/api/related` handler. Fallback to
   `ytmusic.home()`. "For you" section in `SearchView` (rendered with the
   existing `TrackRow`); a dedicated nav destination is a design-phase option.

### Out of Scope

- Backend streaming, download, playlists, video library, lyrics, scrobble, and
  SponsorBlock logic — untouched (only `settings.py` `lastfm_callback` inline
  colors get a palette tweak).
- The `App.tsx` view-state model — kept as-is.
- No new frontend framework and no router (`react-router` deferred to a future
  change); `history.pushState`/`popstate` is optional and a design-phase call.
- No authentication and no multi-user / per-user scoping — history stays global.
- No database or migrations — persistence stays JSON files under `./data`.

## Capabilities

### New Capabilities

- `theme-system`: cool/serene design tokens, light + dark themes via `data-theme`
  on `<html>`, `prefers-color-scheme` default, remembered choice, pre-paint
  anti-FOUC script, per-theme Plyr tokens, PWA color/asset sync.
- `motion-system`: `--dur-*`/`--ease-*` tokens, `@keyframes`,
  `prefers-reduced-motion` guard, native View Transitions for view swaps and the
  now-playing shared-element with a slide-up sheet fallback.
- `responsive-navigation`: left rail on desktop / fixed bottom-nav on mobile on
  the existing view-state model, full-screen now-playing and watch views,
  restored mobile transport/seek control.
- `playback-history`: backend-persisted play history (`./data/history.json`
  service + router), `GET/POST/DELETE /api/history`, entry cap,
  consecutive-repeat dedupe, `recordPlay` client hooks.
- `music-recommendations`: `GET /api/recommendations` from history seeds via
  `ytmusic.related` fan-out, two-layer `deps.cache`, `home()` fallback,
  "For you" UI.

The `styles.css` split (slice 2) and per-view restyle (slice 4) are
implementation-only and introduce no spec-level requirements.

### Modified Capabilities

None (no `openspec/specs/` exist yet).

## Approach

Slices are ordered so each is a standalone PR with its own verification and
rollback. Slice 1 lands the palette + theming + motion tokens. Slice 2 is a pure
mechanical refactor on top of it. Slices 3 and 4 build on 1–2 for layout and
restyle. Slices 5 and 6 are the backend "Part B": 5 adds history persistence and
recording; 6 adds recommendations (depends on 5's history data) and back-fills
caching on `/api/related`. New backend code copies the `services/playlists.py`
pattern verbatim. New frontend API calls go through the `api.ts`
`getJSON`/`send` helpers with shared types in `types.ts`.

Verification is via the dev server, not `npm run build` (project rule: never
build after changes). Slices 5–6 SHOULD (recommended, not mandated) also
introduce test tooling: Vitest + React Testing Library smoke tests for the
frontend, pytest + FastAPI `TestClient` for the new backend routers.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `frontend/src/styles.css` | Modified (1), then Removed (2) | Token rework + literal promotion + motion tokens + light overrides; then split |
| `frontend/src/styles/**` | New (2) | `index.css` + `tokens/base/layout/motion.css` + `components/*.css` |
| `frontend/src/main.tsx` | Modified (2) | Import swap to `./styles/index.css` |
| `frontend/index.html` | Modified (1) | Pre-paint theme script, `theme-color` metas (dark + light media), status-bar style |
| `frontend/src/components/SettingsView.tsx`, `Icon.tsx` | Modified (1) | Theme toggle UI; `sun`/`moon`/`home` glyphs |
| `frontend/src/App.tsx` | Modified (3) | Grid areas, nav row / fixed bottom-nav, `startViewTransition` wrap, full-screen views |
| `frontend/src/components/Sidebar.tsx` → `Nav` | Modified (3) | Responsive rail/bottom-nav |
| `frontend/src/components/PlayerBar.tsx` | Modified (3, 5) | Mobile mini-player + restored transport, shared-element name, full-screen now-playing; `recordPlay` in `useEffect([current])` |
| `frontend/src/components/WatchView.tsx` | Modified (3, 5) | Full-screen watch; `recordPlay` on Plyr `play` |
| `frontend/src/components/QueuePanel.tsx`, `LyricsPanel.tsx` | Modified (3) | Bottom-sheet behaviour |
| `frontend/src/components/*.tsx` + `styles/components/*.css` | Modified (4) | Restyle passes (className / component-CSS only) |
| `frontend/src/api.ts` | Modified (5, 6) | `recordPlay()`, `recommendations()` |
| `frontend/src/types.ts` | Modified (5) | `HistoryEntry` interface |
| `frontend/src/components/SearchView.tsx` | Modified (6) | "For you" section via `TrackRow` |
| `backend/app/services/history.py` | New (5) | JSON-file history service (`playlists.py` pattern) |
| `backend/app/routers/history.py` | New (5, 6) | `/api/history` CRUD; `/api/recommendations` |
| `backend/app/main.py` | Modified (5) | Register router, `history_service.ensure()` in lifespan |
| `backend/app/routers/search.py` | Modified (6) | Add `related:{id}` cache (TTL 3600s) to the `/api/related` handler |
| `backend/app/routers/settings.py` | Modified (1) | `lastfm_callback` inline palette colors |
| `./data/history.json` | New (5) | Runtime, gitignored, seeded from lifespan |
| `frontend/public/sw.js` | Modified (1) | `CACHE` bump `resonar-shell-v1` → `-v2` (mandatory) |
| `frontend/public/manifest.webmanifest` | Modified (1) | `background_color` + `theme_color` |
| `frontend/public/icon*.{svg,png}`, `apple-touch-icon.png` | Modified (1) | Regenerate all 6 if the brand mark leaves violet (design-asset task) |

**New endpoints:** `GET /api/history`, `POST /api/history`, `DELETE /api/history`,
`GET /api/recommendations`.

**New dependencies:** none expected (runtime). Recommended dev-only tooling
(Vitest + RTL, pytest + `TestClient`) is optional and scoped to slices 5–6.

**PWA sync obligations (slice 1):** bump `sw.js` `CACHE` version; add/adjust
`theme-color` metas (dark + `prefers-color-scheme: light`); update
`manifest.webmanifest` colors; regenerate the 6 icons if the brand glyph changes.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `ytmusicapi` is unofficial/brittle; recommendation fan-out multiplies breakage + rate-limit exposure | High | Two-layer cache (`recs:v1:*` + `related:*`), `home()` fallback, short timeouts, capped seeds (10–15) |
| No test runner in either project; large CSS refactor + new endpoints verified manually | Medium | Recommend Vitest + RTL and pytest + `TestClient` in slices 5–6; verify via dev server |
| Theme FOUC on load | Medium | Pre-paint inline `<head>` script sets `data-theme` before first paint |
| Installed PWAs keep the old shell/CSS/icons forever | High if missed | Mandatory `sw.js` `CACHE` version bump (the `activate` handler purges non-current caches) |
| Combined scope far exceeds the 400-line review budget | High | 6 chained, independently reviewable slices |
| `history.json` unbounded growth | Medium | Entry cap (~500–1000) + consecutive-repeat dedupe on write |
| Recommendation cold-cache latency (multi-second) | Medium | Frontend fetches non-blocking with a skeleton |
| `react-router` deferral blocks deep links / back-button this cycle | Low | Deliberate; `pushState`/`popstate` is an optional design-phase add |

## Rollback Plan

- Every slice is a standalone PR, revertable independently.
- Slices 1–4 (frontend CSS/markup only): revert the PR, redeploy static assets,
  and re-bump `sw.js` `CACHE` so clients drop the reverted shell. Slice 2 reverts
  to the single `styles.css` + original `main.tsx` import.
- Slice 5: unregister the router in `main.py`, delete `services/history.py` +
  `routers/history.py`, remove the `recordPlay` calls and `HistoryEntry` type.
  `./data/history.json` is inert runtime data and can be deleted; no other
  service reads it, no migrations.
- Slice 6: remove the `/api/recommendations` handler, the `related:{id}` cache
  lines, `recommendations()` in `api.ts`, and the "For you" section. History data
  is unaffected.
- No database, no destructive migrations anywhere in the change.

## Dependencies

- Slice order: 1 → 2 → 3 → 4 (frontend); 5 → 6 (backend). Slices 3–4 depend on
  1–2; slice 6 depends on slice 5's history data.
- Native View Transitions are progressive enhancement (Chromium); the slide-up
  sheet fallback covers other browsers.
- Recommended dev-only test tooling is non-blocking.

## Success Criteria

- [ ] Cool/serene palette is live; light and dark are both switchable; the choice
      persists across reloads; `prefers-color-scheme` is respected on first
      visit; no FOUC.
- [ ] `prefers-reduced-motion: reduce` disables transitions and animations.
- [ ] Desktop shows the left rail; mobile shows a fixed bottom-nav and a visible
      transport/seek control; now-playing and watch go full-screen on mobile.
- [ ] `styles.css` is split into `styles/**` with zero visual or behaviour
      change.
- [ ] `GET/POST/DELETE /api/history` work; history persists in
      `./data/history.json`, is capped, and consecutive repeats bump
      `playCount`/`playedAt`.
- [ ] Playing a song (`PlayerBar`) or video (`WatchView`) records a history entry
      fire-and-forget.
- [ ] `GET /api/recommendations` returns `{"results": Track[]}`, is cached, and
      falls back to `ytmusic.home()` when seeds/`related` fail.
- [ ] "For you" renders recommendations with the existing `TrackRow`.
- [ ] PWA assets are in sync: `sw.js` `CACHE` bumped, `theme-color` metas +
      manifest colors updated, icons regenerated if the brand mark changed.
- [ ] All slices verified via the dev server (no `npm run build`).

## Resolved Decisions (post-proposal, user-confirmed)

- **"For you" placement**: a section inside `SearchView`, above the existing
  `homeMusic()` feed, together with a "Recently played" section. No dedicated nav
  destination this cycle.
- **Brand glyph**: changes from violet to the sage-teal accent (`~#6DA89B`). All
  6 icons (`icon.svg`, `icon-maskable.svg`, `icon-192.png`, `icon-512.png`,
  `icon-maskable-512.png`, `apple-touch-icon.png`) are regenerated in slice 1.
- **Back-button support**: `history.pushState` + `popstate` IS in scope this
  cycle (slice 3, ~30 lines) so the Android/PWA back gesture navigates between
  views instead of exiting. Still no `react-router` and no shareable deep links.

## Open Questions for the Design Phase

- Exact token hex values across the full ramp (surface elevations, line colors,
  `text-dim`/`text-faint`, `accent-soft`/`accent-2`, `danger`, shadow layers) —
  only palette directions are fixed here. Driven by the visual mockup artifact.
- Recommendations endpoint location: extend `routers/history.py` vs a new
  `routers/recommendations.py`.
- "Confirmed play" semantics: record on start (assumed) vs gate on the
  scrobble-threshold `scrobbledRef`.
- Full-screen now-playing: native View Transitions shared-element as primary vs
  the slide-up sheet as primary on non-Chromium.
- Theme-toggle entry points beyond `SettingsView` (bottom-nav overflow? player
  actions?).
- Whether `DELETE /api/history/{videoId}` (single-entry removal) is in scope or
  only clear-all.
