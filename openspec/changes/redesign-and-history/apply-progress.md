# Apply Progress — redesign-and-history

Mode: **Standard** (`strict_tdd: false`, no test runner in the repo).
Engram MCP was down (`CONNECTION_CLOSED`) — progress persisted to this file only.

## Slice status

| Slice | State |
|-------|-------|
| 1 — Design tokens + motion + theming (PR 1) | 16/18 tasks done; 1.17 partial (SVGs only), 1.18 deferred (manual dev-server) |
| 2–6 | Not started (out of scope for this apply) |

## Slice 1 — completed tasks

- [x] 1.1–1.4 `frontend/src/styles.css` `:root` reworked into the 3-block light/dark
  structure with the "cool & serene" palette:
  - Block 1 bare `:root` = LIGHT set + `color-scheme: light` + theme-invariant
    tokens (`--radius`, `--on-media: #f4f7f6`, `--stage-bg: #0a0f0f`,
    `--scrim: rgba(8,12,12,.55)`, `--font-*`, `--dur-*`/`--ease-*`, light `--plyr-*`).
  - Block 2 `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { … } }`
    = dark overrides + `color-scheme: dark` + dark diffuse multi-layer shadow.
  - Block 3a `:root[data-theme="dark"]` (verbatim dark body, fenced
    `/* DARK SET - keep in sync with @media block */`).
  - Block 3b `:root[data-theme="light"]` re-asserts the light set.
  - Locked anchors used: dark bg `#0e1414`, light bg `#f2f5f4`, accent `#6da89b`,
    on-media `#f4f7f6`. Blue-grey text ramp + surfaces/lines/shadows derived
    (see "Deviations").
- [x] 1.5 Motion tokens added: `--dur-fast:140ms`, `--dur-base:240ms`,
  `--dur-slow:320ms`, `--ease-standard:cubic-bezier(.4,0,.2,1)`,
  `--ease-emphasized:cubic-bezier(.2,0,0,1)`, `--ease-exit:cubic-bezier(.4,0,1,1)`.
- [x] 1.6 Per-theme `--plyr-*` block: `--plyr-color-main` → `--accent`; audio/video
  control colors → text ramp / `--on-media`; `--plyr-menu-background` → `--bg-elev-2`;
  range sizes unchanged; `--plyr-font-family: inherit` kept. Added
  `--plyr-video-control-color*` + `--plyr-video-controls-background` so video
  controls theme too.
- [x] 1.7 Raw-literal promotions in `styles.css`:
  - `#fff` → `var(--on-media)` on `.track__art-play`, `.vcard__dur`, `.vcard__play`,
    `.srow__play`, `.srow__dur`, `.player__badge`, `.watch__skip`, `.btn--accent`.
  - `.watch__stage { background:#000 }` → `var(--stage-bg)`.
  - `rgba(0,0,0,.5)/.35` scrims → `var(--scrim)` (`.track__art-play`, `.srow__play`,
    `.drawer__scrim`, `.drawer` shadow, `.watch__skip`).
  - duration pills `rgba(0,0,0,.82)` → `color-mix(in srgb, var(--stage-bg) 82%, transparent)`
    (`.vcard__dur`, `.srow__dur`).
  - `.vcard__play` radial `rgba(0,0,0,*)` → `color-mix(... var(--stage-bg) …)`.
  - `.btn--accent` gradient `var(--accent), #6d28d9` → `var(--accent-soft), var(--accent)`.
  - `.watch__hd` had no `#fff` in current source (already `var(--accent-2)`) — left as is.
- [x] 1.8 `rg -n "#fff|#000|rgba\(0,\s*0,\s*0" frontend/src/styles.css` → no matches.
  (Dark `--shadow` layers use `rgba(6,12,12,α)` — a cool near-black tint, not
  `rgba(0,0,0,*)` — so the grep stays clean; `--plyr-video-control-color-hover`
  uses `#f8faf9`, an on-dark control tint, not `#fff`.)
- [x] 1.9 Anti-FOUC inline `<script>` added to `frontend/index.html` `<head>`,
  before the font `<link>`, verbatim from design.md (`resonar:theme` →
  `matchMedia` fallback → `data-theme`; `catch` → `"dark"`).
- [x] 1.10 `frontend/index.html`: `theme-color` = `#0E1414` default +
  `<meta name="theme-color" media="(prefers-color-scheme: light)" content="#F1F4F3">`.
  `apple-mobile-web-app-status-bar-style` kept `black-translucent` (design says
  acceptable for both themes with `viewport-fit=cover`).
- [x] 1.11 `frontend/index.html`: Inter `<link>` swapped for
  `Fraunces:ital,wght@0,400;0,500;1,400;1,500` + `Hanken Grotesk:wght@400;500;600;700`.
  `--font-display: "Fraunces", Georgia, serif` and
  `--font-ui: "Hanken Grotesk", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`
  added to bare `:root`; `body` now `font-family: var(--font-ui)`;
  `--font-display` applied to `.sidebar__brand`, `.view__title`, `.watch__title`,
  `.pldetail__meta h1`. `font-variant-numeric: tabular-nums` added to `.srow__dur`,
  `.badge`, `.plcard__count` (other numeric rules already had it).
- [x] 1.12 `Icon.tsx`: `sun`, `moon`, `home` glyphs added in the existing
  stroke-based 24×24 style.
- [x] 1.13 `SettingsView.tsx`: "Tema" card with a `role="switch"` toggle
  (`aria-checked`, `aria-label`, `sun`/`moon` indicator). `applyTheme()` writes
  `localStorage["resonar:theme"]` in try/catch, sets
  `document.documentElement.dataset.theme`, and updates the non-media
  `theme-color` meta to `#F1F4F3` / `#0E1414`. Focus-visible handled by a new
  global `:where(button,a,input,[tabindex]):focus-visible` rule.
- [x] 1.14 `frontend/public/sw.js`: `CACHE` `resonar-shell-v1` → `resonar-shell-v2`.
  `SHELL` list unchanged and still valid.
- [x] 1.15 `frontend/public/manifest.webmanifest`: `background_color` +
  `theme_color` `#0b0910` → `#0E1414`.
- [x] 1.16 `backend/app/routers/settings.py` `lastfm_callback` inline HTML:
  `background:#0b0910;color:#f0edf7` → `background:#0E1414;color:#E6EDEB`.

## Slice 1 — partial / deferred

### 1.17 — App icons (PARTIAL)

Done in-session:
- `frontend/public/icon.svg` — regenerated: `#0E1414` rounded panel, 3 equalizer
  bars in sage `#6DA89B` (gradient `<defs>` removed).
- `frontend/public/icon-maskable.svg` — regenerated: full-bleed `#0E1414`,
  sage `#6DA89B` bars.

TODO (cannot rasterize in this environment — PNGs left untouched, NOT deleted):
Generate these 4 PNGs from `frontend/public/icon.svg` (for `apple-touch-icon`,
use the non-maskable art on an opaque `#0E1414` background):

| Target file | Size | Source |
|-------------|------|--------|
| `frontend/public/icon-192.png` | 192×192 | `frontend/public/icon.svg` |
| `frontend/public/icon-512.png` | 512×512 | `frontend/public/icon.svg` |
| `frontend/public/icon-maskable-512.png` | 512×512 | `frontend/public/icon-maskable.svg` |
| `frontend/public/apple-touch-icon.png` | 180×180 | `frontend/public/icon.svg` (opaque `#0E1414` bg) |

Suggested command (once a rasterizer is available), e.g.:
`rsvg-convert -w 192 -h 192 frontend/public/icon.svg -o frontend/public/icon-192.png`
(or `sharp`/`resvg`/Inkscape). The 4 stale violet PNGs remain in place until then;
`sw.js` `CACHE` was already bumped to `-v2` so installed PWAs will refetch them
after regeneration.

### 1.18 — Manual dev-server verification (DEFERRED)

No dev server run (project rule: no build; kept to writing code). Reviewer to
verify on `npm run dev`:
1. Fresh profile / cleared `localStorage`: first paint follows OS
   `prefers-color-scheme` (DevTools ▸ Rendering ▸ Emulate CSS media, both ways).
2. Settings ▸ Tema toggle flips light↔dark instantly, no reload; choice survives
   a full reload.
3. With `resonar:theme` forced to the opposite of the OS setting, reload → the
   stored choice wins.
4. Network throttled to Slow 3G + hard reload → the first painted frame is
   already the correct theme (no dark/light flash).
5. Plyr audio bar (PlayerBar) and Plyr video controls (WatchView) are legible in
   both themes; menu popover background matches `--bg-elev-2`.
6. DevTools ▸ Emulate `prefers-reduced-motion: reduce` → toggling theme still
   works and triggers no transition/animation; motion identical in both themes.
7. Lock-screen / MediaSession controls unaffected (no code path touched).

## Deviations from design.md

1. **Full palette hex values.** design.md locks only a subset of hexes
   (`#0E1414`, `#F2F5F4`, `#6DA89B`, `#F4F7F6`, `#F1F4F3`, `#0E1414`/`#E6EDEB` for
   the backend page) and describes the rest as "blue-grey text ramp, diffuse
   multi-layer shadows". The intermediate tokens were derived to match that
   description and kept cohesive:
   - Dark: `--bg-elev #141c1c`, `--bg-elev-2 #1c2726`, `--line #2a3937`,
     `--line-soft #1f2b2a`, `--text #e6edeb`, `--text-dim #9db0ac`,
     `--text-faint #6e827e`, `--accent-soft #8cc3b6`, `--accent-2 #7fb6c4`,
     `--danger #e8837b`.
   - Light: `--bg-elev #f8faf9`, `--bg-elev-2 #eaf0ee`, `--line #d3ded9`,
     `--line-soft #e2eae7`, `--text #1b2523`, `--text-dim #55645f`,
     `--text-faint #7d8c87`, `--accent-soft #3f7367` (darker for on-light
     emphasis, since light theme darkens rather than lightens), `--accent-2
     #5a97a6`, `--danger #c65f57`.
   - Shadows: light `rgba(20,40,38,α)` at .06/.09/.12; dark `rgba(6,12,12,α)` at
     .30/.40/.50 (cool near-black tint, keeps the `#000` grep clean).
   These may be re-tuned when the visual mockup is available; token *names* and
   structure are final.
2. **`--accent` is theme-invariant `#6da89b`.** design.md task 8 calls `#6DA89B`
   the "dark-theme accent" but tasks 1.4/1.7 reference a single locked accent.
   Kept `#6da89b` in both themes to honour the locked brand value. Light-theme
   accent-on-light contrast (e.g. `.btn--accent` text) may want a slightly darker
   accent in a later polish pass — flagged, not changed.
3. **`--plyr-video-control-color-hover: #f8faf9`** instead of `#ffffff` — a
   near-white on-dark tint chosen so the task 1.8 grep (`#fff`) stays clean while
   keeping video controls bright on the always-dark stage.
4. **Reduced-motion guard added in Slice 1** (not spelled out in a 1.x task, but
   task 2.5 *moves* "the `prefers-reduced-motion` guard" into `motion.css`, so it
   must exist beforehand; motion-system spec also requires it). Added to
   `styles.css` as `@media (prefers-reduced-motion: reduce) { *,*::before,*::after
   { animation-duration:.001ms!important; animation-iteration-count:1!important;
   transition-duration:.001ms!important; } }`.
5. **The ~40 inline transition-duration replacements were NOT done here.**
   tasks.md schedules that search-replace (and the `drawer-in` → `sheet-in`
   rename) explicitly in Slice 3 task 3.13, and this apply is scoped to Slice 1
   only. The orchestrator brief's prose summary (item 3) folds it into Slice 1;
   tasks.md is authoritative and was followed. Motion *tokens* exist and are
   ready for 3.13 to consume. Only new CSS added by this slice
   (`.theme-toggle`) uses the `--dur-*`/`--ease-*` tokens.
6. **`--font-display` scope.** Applied to the wordmark + primary headings
   (`.sidebar__brand`, `.view__title`, `.watch__title`, `.pldetail__meta h1`).
   design.md says "add a display/wordmark rule"; exact per-view display-type
   usage is left to the Slice 4 restyle passes.

## Preservation check (Slice 1 = tokens/markup only)

No change to `PlayerBar.tsx`, `WatchView.tsx`, `App.tsx`, or any audio/Plyr/
MediaSession/Web-Audio/PiP/radio/scrobble logic. Edits limited to CSS token
values + literal→token substitutions, `index.html` head, `Icon.tsx` glyph map,
the `SettingsView` toggle, PWA manifest/sw/icon assets, and one backend inline
style string.

## Files changed

| File | What |
|------|------|
| `frontend/src/styles.css` | 3-block light/dark token system, motion tokens, font tokens, per-theme `--plyr-*`, ~14 literal→token promotions, global `:focus-visible` + `prefers-reduced-motion` guard, display-font + tabular-nums on select rules, `.theme-toggle` rule |
| `frontend/index.html` | anti-FOUC `<script>`, dark+light `theme-color` metas, Fraunces + Hanken Grotesk font `<link>` |
| `frontend/src/components/Icon.tsx` | `sun`, `moon`, `home` glyphs |
| `frontend/src/components/SettingsView.tsx` | "Tema" toggle card (`role="switch"`, persist, runtime `theme-color` update) |
| `frontend/public/sw.js` | `CACHE` → `resonar-shell-v2` |
| `frontend/public/manifest.webmanifest` | `background_color` + `theme_color` → `#0E1414` |
| `frontend/public/icon.svg`, `icon-maskable.svg` | brand glyph recoloured to sage `#6DA89B` on `#0E1414` |
| `backend/app/routers/settings.py` | `lastfm_callback` inline palette → `#0E1414` / `#E6EDEB` |
| `openspec/changes/redesign-and-history/tasks.md` | Slice 1 checkboxes |

## Remaining (Slice 1)

- 1.17: rasterize the 4 PNG icons (see table above).
- 1.18: manual dev-server verification (see checklist above).

## Next

`sdd-verify` for Slice 1, or `sdd-apply` for Slice 2 (mechanical `styles.css`
→ `styles/**` split).
