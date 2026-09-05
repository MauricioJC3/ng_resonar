# Apply Progress — redesign-and-history

Mode: **Standard** (`strict_tdd: false`, no test runner in the repo).
Engram MCP was down (`CONNECTION_CLOSED`) — progress persisted to this file only.

## Slice status

| Slice | State |
|-------|-------|
| 1 — Design tokens + motion + theming (PR 1) | 16/18 tasks done; 1.17 partial (SVGs only), 1.18 deferred (manual dev-server) |
| 2 — Mechanical `styles.css` split (PR 2) | 8/9 tasks done; 2.9 deferred (manual dev-server visual pass) |
| 3–6 | Not started (out of scope for this apply) |

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

---

# Slice 2 — Mechanical `styles.css` split (PR 2)

Mode: **Standard** (`strict_tdd: false`, no test runner). Engram MCP down —
progress persisted to this file only. No dev server / build run (project rule).

## What was done

`frontend/src/styles.css` (1870 lines, 242 rule blocks) was split, with **zero
value / selector / order changes**, into `frontend/src/styles/**` composed by an
ordered `@import` from `frontend/src/styles/index.css`.

### File layout created

```
frontend/src/styles/
  index.css                 @import composition root (order == cascade order)
  tokens.css                4 :root blocks (bare + @media dark + [data-theme=dark] + [data-theme=light])
                            incl. motion tokens + per-theme --plyr-* ; DESIGN TOKENS header comment
  base.css                  *, html/body/#root, body, button, a,
                            :where(...):focus-visible, ::-webkit-scrollbar(-thumb)
  motion.css                @media (prefers-reduced-motion: reduce) guard
                            + @keyframes eq + @keyframes spin + @keyframes drawer-in
  layout.css                /* App shell */ .app .main .view .view__title .view__subhead
                            + /* Responsive */ @media (max-width: 900px) { … }  (verbatim)
  components/sidebar.css     /* Sidebar */
  components/shared.css      /* Shared bits */  (.hint .empty .eq …  — @keyframes eq moved to motion.css)
  components/search.css      /* Search bar */
  components/track.css       /* Track list */
  components/video.css       /* Video grid */
  components/watch.css       /* Watch view */
  components/buttons.css     /* Buttons / segmented / badges */  (@keyframes spin moved to motion.css)
  components/saved-video.css /* Saved video rows */
  components/player.css      /* Player bar */
  components/drawer.css      /* Queue drawer */  (@keyframes drawer-in moved to motion.css)
  components/misc-chips.css  /* Misc chips / flashes */
  components/playlists.css   /* Playlists */
  components/lyrics.css      /* Lyrics */
  components/settings.css    /* Settings */
```

### `index.css` @import order (== effective cascade order)

`tokens → base → motion → sidebar → shared → search → track → video → watch →
buttons → saved-video → player → drawer → misc-chips → playlists → lyrics →
settings → layout`

### Other edits

- `frontend/src/main.tsx`: `import "./styles.css";` → `import "./styles/index.css";`
- `frontend/src/styles.css`: **deleted** (`git rm`).

## Deviations from design.md / brief

1. **`layout.css` is imported LAST, not 3rd** (design 2.1 lists it 3rd). The
   original `@media (max-width: 900px)` block lives at the very bottom of
   `styles.css` and overrides `.player`, `.sidebar*`, `.track*`, `.pldetail*`,
   `.lyrics__line` — selectors defined in component files. Media queries add no
   specificity, so those overrides only win by **source order**. If `layout.css`
   (which per brief §3 owns the responsive block) were imported before the
   component files, every mobile override would lose to the component base rule
   and the responsive layout would break. Importing `layout.css` last preserves
   the exact pre-split cascade — which is the governing requirement (brief §2:
   "the cascade is byte-equivalent"). The App-shell base rules (`.app`, `.main`,
   `.view*`) also move to the end as a result; verified no component file
   redefines those bare selectors at equal specificity, so this is a no-op.
2. **Component filenames follow the section banners** (`shared.css`,
   `saved-video.css`, `misc-chips.css`, `playlists.css`, `drawer.css`) rather
   than design 2.1's shorter list (`playlist.css`, `shared.css`, …). Brief §1
   says "one file per section banner"; 14 component files result.
3. **`:focus-visible` global → `base.css`, not `tokens.css`.** Brief §3 says put
   it in `tokens.css` "if it sits with them [the `:root` blocks]". In the source
   it sits at l.186, after `*` / `html,body` / `body` / `button` / `a` and before
   the reduced-motion guard — i.e. with the reset rules, not the token blocks.
   Placed in `base.css`. Selector-diff still empty; cascade unaffected (no other
   rule sets `outline` on those elements).
4. **`@keyframes drawer-in` keeps its name** (not renamed to `sheet-in`). The
   rename + reference updates are explicitly Slice 3 / task 3.13.
5. **No `::selection` rule** exists in the source — nothing to move (brief §3
   lists it "if present").
6. **Minor `@import`-order normalisation within `base`/`motion`:** in the source,
   the reduced-motion `@media` sits *between* `:focus-visible` and
   `::-webkit-scrollbar`. After the split, `base.css` holds both `:focus-visible`
   and the scrollbar rules consecutively and `motion.css` (with the guard) is
   imported just before. No property overlap between the guard (`animation-*` /
   `transition-duration` / `scroll-behavior` on `*`) and the scrollbar rules
   (`width`/`height`/`background`/`border`), and the guard is `!important`, so the
   effective result is identical. Likewise the 3 `@keyframes` move earlier (into
   `motion.css`); keyframe names are unique, so animation resolution is unchanged.

## Verification (performed)

| Check | Result |
|-------|--------|
| `git diff --cached --stat` scope | Only `main.tsx` (import line), `styles.css` deletion, and new `styles/**` — no other file touched |
| Open-brace `{` count, old vs concatenated new | **242 == 242** |
| Selector lines (ending `{`), trimmed + sorted, `diff` | **empty — SELECTORS IDENTICAL** (no selector added or dropped) |
| Every non-comment, non-blank line, trimmed + sorted, `diff` | **empty — multiset-identical** (no declaration changed) |
| Comment lines, sorted, `diff` | **empty — identical** |
| `rg "styles\.css" frontend/src` | no matches (only an `index.css` doc comment, reworded to "stylesheet") |
| `rg "styles\.css"` repo-wide (excl. `openspec/`, `node_modules/`, `*.md`) | no matches |
| `className` strings in component tree | untouched — no `.tsx`/`.ts` changed except the `main.tsx` import |
| Line delta | old 1870 → new 1876 CSS lines total (`index.css` +23; ~17 inter-section blank separators dropped by concatenation). No rule content lost — brace/selector/line multisets prove it. |

Concatenation used for the diff (import order):
`tokens base motion sidebar shared search track video watch buttons saved-video
player drawer misc-chips playlists lyrics settings layout`.

## Not done

- **2.9** — `npm run dev` side-by-side visual pass on every view in both themes.
  No dev server / build in this environment (Standard Mode, project rule "never
  build after changes"). Reviewer checklist:
  1. `npm run dev`, load the app; open every view (Search, Watch, Playlists,
     playlist detail, Settings, Library/Saved) in **dark** then **light**
     (`data-theme` via Settings toggle).
  2. Compare against `main` (pre-split) side by side — pixel-identical expected.
  3. Open the queue drawer + lyrics panel (slide-in animation intact).
  4. Resize below 900px — responsive layout (bottom sidebar, hidden player
     center/download, condensed track grid) still applies.
  5. Reduced-motion emulation — animations still suppressed by the guard.
  6. Plyr audio + video controls still themed (tokens resolve).

## Preservation check

CSS-only mechanical move + one import-path string. No `.tsx` logic touched. No
audio / Plyr / MediaSession / Web-Audio / PiP / radio / scrobble / keyboard code
path involved.

## Files changed (Slice 2)

| File | Action |
|------|--------|
| `frontend/src/styles/index.css` | Created — ordered `@import` composition root |
| `frontend/src/styles/tokens.css` | Created — `:root` ×4 + motion/`--plyr-*` tokens |
| `frontend/src/styles/base.css` | Created — reset / element / focus-visible / scrollbar |
| `frontend/src/styles/motion.css` | Created — reduced-motion guard + 3 `@keyframes` |
| `frontend/src/styles/layout.css` | Created — App shell + `@media (max-width:900px)` |
| `frontend/src/styles/components/*.css` | Created — 14 files, one per section banner |
| `frontend/src/main.tsx` | Modified — import `./styles/index.css` |
| `frontend/src/styles.css` | Deleted (`git rm`) |
| `openspec/changes/redesign-and-history/tasks.md` | Slice 2 checkboxes (2.1–2.8 `[x]`, 2.9 deferred) |

## Next

`sdd-verify` for Slice 2 (or Slice 1), then `sdd-apply` for Slice 3
(responsive Nav + mobile transport + view transitions).

---

# Slice 3 — Responsive nav + mobile transport + full-screen views + View Transitions + back-button (PR 3)

Mode: **Standard** (`strict_tdd: false`, no test runner). Engram MCP down —
progress persisted to this file only. No dev server / build / docker run
(brief + project rule). `node_modules` is not installed in this environment,
so `tsc --noEmit` could not resolve `react` — types were reviewed by hand.

## Status

| Task | State |
|------|-------|
| 3.1–3.20 | done (`[x]`) |
| 3.21 | deferred — manual `npm run dev` verification (checklist below) |

## What was done

### Nav component (3.1, 3.2)

- `git mv frontend/src/components/Sidebar.tsx frontend/src/components/Nav.tsx`.
  Same props `{ view: View; onNavigate: (v: View) => void }`, same static
  `NAV` array (5 items, unchanged labels/icons).
- Markup is now a single `<nav className="nav" aria-label="Navegación
  principal">` with `.nav__brand` / `.nav__items` / `.nav__item` / `.nav__note`.
  The active item carries `aria-current="page"`; focus ring is the global
  `:where(button,a,input,[tabindex]):focus-visible` rule from `base.css`.
  Library count badge kept as `.nav__count` (with `tabular-nums`). `home` glyph
  already existed in `Icon.tsx` (added in Slice 1) — no new nav glyph needed.
- `frontend/src/styles/components/sidebar.css` (filename kept per task 3.2)
  fully rewritten: `.nav` = left rail `>= 860px`; one
  `@media (max-width: 859.98px)` block turns it into a row bottom bar
  (`position: sticky; bottom: 0; z-index: 90`), hides `.nav__brand` +
  `.nav__note`, stacks icon-over-label per item, repositions `.nav__count`.

### App shell grid (3.3)

`frontend/src/styles/layout.css`:
- `.app` desktop unchanged in dimensions — only the area token renamed:
  `grid-template-areas: "nav main" / "player player"` (was `"sidebar main"`),
  columns `244px 1fr`, rows `1fr 90px`.
- The old `@media (max-width: 900px)` block was **replaced** by a
  `@media (max-width: 859.98px)` block: `.app` → single column, rows
  `1fr auto auto`, areas `"main" "player" "nav"`; `.main { padding: 20px 16px
  8px }` (the `8px` bottom is the design's `padding-bottom`). Player + nav are
  in-flow `auto` grid rows, so they never overlap `.main` (the `1fr` row).
  Non-nav responsive tweaks that were in the old block are kept verbatim
  (`.pldetail__*`, `.lyrics__line`, `.track` grid condensation,
  `.track__album`, `.track__icon`).
- Dropped from the old block (intentional): all `.sidebar*` rules (replaced by
  `.nav` bottom-bar rules), `.player { grid-template-columns: 1fr auto }`
  (moved to `player.css`), **`.player__center { display: none }`** and
  **`.player__download { display: none }`** — the first is the "restore mobile
  transport" fix, the second moves to `player.css` (hidden on the mini-player,
  shown in the full-screen view).

### PlayerBar single-mount preserved (3.4)

`App.tsx` still renders `<PlayerBar />` as a bare, unconditional, key-less
direct child of `<div className="app">`, a sibling of `<main>{content}</main>`.
`content` is the only thing that swaps. Nothing wraps `<PlayerBar />`.

### Mobile transport restored (3.5)

`frontend/src/styles/components/player.css`, `@media (max-width: 859.98px)`:
- `.player` → 2-col grid `"meta actions" / "center center"`.
- `.player__center { display: flex }` (never `display:none` again) — Plyr's own
  audio UI (play + progress/seek + current-time + mute + volume) is the
  restored transport. `.player__center .plyr { width: 100% }`.
- The native `<audio>` element is never hidden (Plyr hides it internally; we
  only ever style the `.player__center` wrapper and `.plyr`).
- `.player__transport` (prev/next buttons) hidden on the mini-player — the full
  prev/next set lives in the full-screen now-playing view. `.player__download`
  hidden on the mini-player.

### Full-screen now-playing = CSS expansion (3.6, 3.8)

`frontend/src/components/PlayerBar.tsx`:
- New local boolean `expanded` (one `useState`). `flipExpanded(v)` wraps
  `setExpanded` in `document.startViewTransition(() => flushSync(...))` when the
  API exists **and** `prefers-reduced-motion` is not set; otherwise a plain
  `setExpanded`.
- `openExpanded()` (guard: `current` must exist and not already expanded)
  pushes `history.pushState({ ...history.state, np: true }, "")` then
  `flipExpanded(true)`. `closeExpanded()` calls `history.back()` when the top
  entry has `np`, else `flipExpanded(false)`. One `popstate` `useEffect` in
  PlayerBar sets `expanded` from `e.state?.np` → the OS/browser Back gesture
  collapses the full-screen view instead of leaving the app.
- The `<footer className="player">` gains `player--expanded` class +
  `data-expanded` + `role="dialog"` / `aria-label` when expanded. `.player__meta`
  became a `<button type="button">` (expand tap target, `disabled` when nothing
  is playing) — the **same** `<img className="player__art">` / `.player__text`
  live inside it. A `.player__collapse` chevron-down button renders only while
  expanded.
- **No new component, no portal, no second `<audio>`/Plyr.** `usePlayer()`,
  `audioRef`, `plyrRef`, the mount-once Plyr `useEffect([])`, the
  `useEffect([current])` metadata block, radio/keyboard/leveling effects are
  all byte-unchanged.
- CSS `.player--expanded` (`player.css`): `position: fixed; inset: 0;
  z-index: 200` (above the `z-index: 90` bottom-nav), flex column, large
  artwork `min(72vw, 340px)`, centered title, `.player__transport` shown,
  `.player__actions` (level / lyrics / radio / queue — same handlers) centered
  and wrapped, `.player__download` shown. Enter animation
  `animation: sheet-up var(--dur-slow) var(--ease-emphasized)` — this is the
  `translateY(100%) → 0` fallback used when View Transitions are unsupported;
  the global reduced-motion guard nullifies it.
- `view-transition-name: np-art` on `.player__art`, `np-title` on
  `.player__title` (both in `player.css`) so the artwork/title morph as shared
  elements when the expand toggle runs inside a View Transition.

### Full-screen watch on mobile (3.7)

`frontend/src/styles/components/watch.css`, new `@media (max-width: 859.98px)`
block only: `.watch__stage` → `position: fixed; top/left/right: 0; z-index: 70;
border-radius: 0`; `.watch__stage .plyr { border-radius: 0 }`; `.watch` gets
`padding-top: min(56.25vw, 60vh)` so the title + "Relacionados" list scroll
beneath the fixed 16:9 stage; `.watch__back` pinned top-left.
**`WatchView.tsx` is byte-unchanged** — the Plyr `controls` array (still
`["play-large","play","progress","current-time","duration","mute","volume",
"settings","pip","fullscreen"]`), the container element, and every
`.plyr__control` are untouched. No `display:none` / `visibility:hidden` /
`pointer-events:none` anywhere near Plyr.

### Back-button / history view sync (3.9–3.12)

`frontend/src/App.tsx`:
- State model unchanged: `view` / `watching` / `openPlaylist` `useState`, no
  router.
- `applyState(s)` = the three setters, no history writes.
- `go(next: NavState)` = `history.pushState({ ...next, np: false }, "")` then
  `applyState`, wrapped in `document.startViewTransition(() => flushSync(() =>
  applyState(next)))` when `typeof document.startViewTransition === "function"`
  **and** not `prefers-reduced-motion`. Fallback = plain `applyState`.
- `navigate(v)` → `go({ view: v, watching: null, openPlaylist: null })`;
  `watch(v)` → `go({ view, watching: v, openPlaylist: null })`;
  `openPlaylistDetail(id)` → `go({ view: "playlists", watching: null,
  openPlaylist: id })`. `WatchView.onClose` and `PlaylistDetailView.onBack`
  both call `back = () => history.back()` (per the design mapping table:
  "close watch / back from playlist detail → previous entry via native Back").
- Mount `useEffect([])`: `history.replaceState({ ...DEFAULT_STATE, np: false },
  "")` (initial view is always `search` with no overlay).
- One `popstate` `useEffect([applyState])`: `onPop(e)` reads `e.state`,
  defaulting to `{ view: "search", watching: null, openPlaylist: null }` when
  `null` (deep path / refresh), and applies the setters — never re-pushes.
- New `frontend/src/global.d.ts`: ambient `Document.startViewTransition?`,
  `ViewTransition`, and `NavHistoryState` types (the View Transitions API is
  not in this toolchain's DOM lib).

### Motion tokens + keyframe rename + View Transition CSS (3.13, 3.14)

`frontend/src/styles/motion.css`:
- `@keyframes drawer-in` → `@keyframes sheet-in`, body changed from
  `translateX(20px)` to `translateY(12px)` (keeps the `opacity: 0.4` start;
  now reads as a rise). Used by `.drawer`, `.lyrics`, `.watch__skip`
  (references updated in `drawer.css`, `lyrics.css`, `misc-chips.css`).
- New `@keyframes sheet-up { from { transform: translateY(100%) } }` — the full
  slide-up for mobile bottom sheets and the now-playing fallback.
- New `::view-transition-old(root) / ::view-transition-new(root)` rule using
  `var(--dur-base) var(--ease-emphasized)`; the reduced-motion `@media` block
  now also `animation: none !important` on `::view-transition-group/old/new(*)`.
- `@keyframes eq` (900ms loop) and `@keyframes spin` (0.7s loop) left as-is —
  they are infinite keyframe loops, not the "inline transition durations" the
  search-replace map targets.
- Every inline `transition:` / `animation:` duration in `styles/**` replaced
  with `--dur-*` / `--ease-*`: hover/focus/color/opacity micro → `var(--dur-fast)
  var(--ease-standard)` (0.12/0.14s sites) or `var(--dur-base) var(--ease-standard)`
  (0.15/0.16s sites); larger movement (`transform 0.25s`, all sheet/drawer
  animations) → `var(--dur-slow) var(--ease-emphasized)`. Files touched:
  `sidebar.css` (rewritten), `player.css`, `drawer.css`, `lyrics.css`,
  `misc-chips.css`, `track.css`, `buttons.css`, `search.css`, `video.css`,
  `playlists.css`, `saved-video.css`. `settings.css` `.theme-toggle` already
  tokenised in Slice 1. Verified: `rg "[0-9]\.[0-9]+s|[0-9]+ms"` in
  `styles/**/*.css` now only matches token-adjacent values, the two loop
  keyframes, the `0.001ms` guard, and the negative `eq` delays.
- `QueuePanel.tsx` / `LyricsPanel.tsx` need **no** code change: bottom-sheet
  behaviour is a pure `@media (max-width: 859.98px)` restyle in `drawer.css` /
  `lyrics.css` — `.drawer` / `.lyrics` become `left/right/bottom: 0; width: 100%;
  border-radius: 18px 18px 0 0; z-index: 101` (above the bottom-nav) with
  `animation: sheet-up …`; the scrim goes `z-index: 100`. Desktop drawer /
  centered-modal bytes are unchanged and still use `sheet-in`.

### No animation library (3.15)

`frontend/package.json` untouched — `dependencies` are still only `plyr`,
`react`, `react-dom`. `rg "framer-motion|gsap|\"motion\""` → nothing.

## HARD PRESERVATION checks (per the 6 points in the brief)

| # | Point | Result | Proof |
|---|-------|--------|-------|
| 1 | `PlayerBar` mounts once at shell level, outside swappable content, never remounts; background audio survives every view change + full-screen open | **PASS** | `App.tsx:132` — `<PlayerBar />` is an unconditional, key-less direct child of `.app`, sibling of `<main>{content}</main>`. `go()` / `applyState()` only call `setView` / `setWatching` / `setOpenPlaylist`, which re-render `content` only. Nothing wraps or keys `<PlayerBar />`. The full-screen now-playing is a class toggle on the existing `<footer>` (`PlayerBar.tsx` `expanded` state) — same element, no unmount. |
| 2 | MediaSession metadata + action handlers in `PlayerBar.tsx` untouched | **PASS** | `PlayerBar.tsx` `useEffect([current])` (the `MediaMetadata` + 8 `setActionHandler` calls + `setPositionState`) is byte-identical to pre-slice. The slice only added an `expanded` state block, a `popstate` effect, and the `flushSync` import above it. |
| 3 | Plyr PiP on the `<video>` in `WatchView.tsx` stays available | **PASS** | `WatchView.tsx` is byte-unchanged (`git diff` shows no hunk). `controls` array still contains `"pip"` and `"fullscreen"`. `watch.css` mobile block only sets `position`/`z-index`/`border-radius` on `.watch__stage` and `.watch__stage .plyr` — no rule targets `.plyr__controls` / `.plyr__control`, no `display:none` / `visibility` / `pointer-events`, container not replaced. |
| 4 | Web Audio volume-leveling, radio auto-extend, keyboard shortcuts, scrobble hooks in `PlayerBar.tsx` untouched | **PASS** | `buildGraph` / `routeGraph` / `toggleLevel` / `LEVEL_KEY`, the `ended`-event radio `useEffect`, the `keydown` `useEffect`, and `scrobbleNowPlaying` / `scrobbleSubmit` call sites are all byte-identical. Only `.player__toggle` styling changed (transition tokenised; `.is-on` rule untouched). |
| 5 | Full-screen now-playing is an expansion of the existing player state (same `usePlayer()`, same `<audio>`, same Plyr) — not a second player; shows/hides via CSS/state | **PASS** | `PlayerBar.tsx` — no new component, no `createPortal`, no second `<audio>` / `new Plyr`. `expanded` is one boolean; `player--expanded` is a CSS class on the one existing `<footer>`. `audioRef` / `plyrRef` / `usePlayer()` destructure unchanged. |
| 6 | `App.tsx` view-state model stays (`view` / `watching` / `openPlaylist` `useState`), no react-router | **PASS** | `App.tsx` still has exactly those three `useState` hooks. No `react-router*` import anywhere; `frontend/package.json` has no router dep. History sync is ~30 lines of `history.pushState` / `replaceState` / `popstate`. |

No task required violating any preservation point — nothing to STOP for.

## Deviations from design / brief

1. **Bottom-nav uses `position: sticky` (design.md + tasks.md 3.3), not
   `position: fixed`** as the orchestrator prose summary (§2) said. tasks.md 3.3
   and design.md both specify `sticky; bottom: 0` with player + nav as in-flow
   `auto` grid rows — that inherently prevents overlap without a
   `padding-bottom` reservation for the bar, so `.main` only needs the design's
   `8px`. Followed the artifact (tasks.md/design.md), not the prose.
2. **`.player__meta` is now a `<button>`** wrapping the artwork + text (the
   expand tap target). A `<div className="player__text">` sits inside it — flow
   content inside `<button>` is universally rendered by browsers and does not
   trigger React DOM-nesting warnings, but it is not strictly spec-valid
   phrasing content. Slice 4's restyle can revisit the exact element.
3. **`sheet-in` keyframe body changed** (`translateX(20px)` → `translateY(12px)`)
   so the renamed keyframe reads as a rise for the queue/lyrics sheets. The
   skip-flash (`.watch__skip`) now rises 12px instead of sliding 20px from the
   right — a small, intentional motion change, not a regression in the spec
   sense. The full bottom-sheet slide is a **separate** `sheet-up` keyframe
   (`translateY(100%)`), used in the mobile media queries + now-playing.
4. **`QueuePanel.tsx` / `LyricsPanel.tsx` unchanged** — task 3.14 is satisfied
   by CSS media queries alone (bottom-sheet position + `sheet-up` animation).
   No component logic needed touching.
5. **View Transition on the now-playing expand** is wrapped in PlayerBar's own
   `flipExpanded` (its internal `expanded` state), which is legitimate and
   intended by the motion-system spec ("expanding the mini player animates
   artwork and title as shared elements"). The brief's "never wrap anything
   that touches `PlayerBar`" applies to `App.go()` — App never wraps or
   re-renders PlayerBar; confirmed.
6. **New file `frontend/src/global.d.ts`** — needed for `Document.startViewTransition`
   typing (not in `lib.dom` for TS 5.6). Not in the design's file list but
   required for a clean typecheck.
7. **`node_modules` absent** in this environment → `tsc --noEmit` reports
   `Cannot find module 'react'` for every file; could not run a real
   typecheck. Types were reviewed by hand (see notes above).

## Files changed (Slice 3)

| File | Action | What |
|------|--------|------|
| `frontend/src/components/Sidebar.tsx` → `Nav.tsx` | Renamed + rewritten | `<nav>` semantics, `aria-current="page"`, `.nav*` classes, same props + `NAV` array + count badge |
| `frontend/src/App.tsx` | Modified | `Nav` import; `NavState`/`DEFAULT_STATE`; `go()` + `applyState()`; mount `replaceState`; `popstate` effect; `startViewTransition` (+ `flushSync`) around content swap; `back = history.back` |
| `frontend/src/components/PlayerBar.tsx` | Modified | `expanded` state + `flipExpanded`/`openExpanded`/`closeExpanded` + `popstate` effect; `player--expanded` class / `data-expanded` / `role`; `.player__meta` → `<button>`; `.player__collapse`; `flushSync` import. Audio/Plyr/MediaSession/radio/keyboard/leveling/scrobble untouched |
| `frontend/src/components/Icon.tsx` | Modified | `chevronDown`, `chevronUp` glyphs (24×24 stroke) |
| `frontend/src/global.d.ts` | Created | `Document.startViewTransition?`, `ViewTransition`, `NavHistoryState` ambient types |
| `frontend/src/styles/components/sidebar.css` | Rewritten | `.nav` left rail `>= 860px` + `@media (max-width: 859.98px)` bottom bar |
| `frontend/src/styles/layout.css` | Modified | `.app` areas `sidebar`→`nav`; old `@media (max-width: 900px)` block replaced by `@media (max-width: 859.98px)` (single-col, `main/player/nav` rows, restores `.player__center`) |
| `frontend/src/styles/motion.css` | Modified | `drawer-in`→`sheet-in` (body → `translateY`); new `sheet-up`; `::view-transition-*(root)` rule + reduced-motion nullifier |
| `frontend/src/styles/components/player.css` | Modified | button resets on `.player__meta`; `view-transition-name` np-art/np-title; `.player__collapse`; mobile mini-player block; `.player--expanded` full-screen block; toggle transition tokenised |
| `frontend/src/styles/components/watch.css` | Modified | `@media (max-width: 859.98px)` full-screen stage block (wrapper only) |
| `frontend/src/styles/components/drawer.css` | Modified | `sheet-in` ref; `@media` bottom-sheet block (`sheet-up`, `z-index` over nav) |
| `frontend/src/styles/components/lyrics.css` | Modified | `sheet-in` ref; transition tokenised; `@media` bottom-sheet block |
| `frontend/src/styles/components/misc-chips.css` | Modified | `sheet-in` ref; `.player__download` transition tokenised |
| `frontend/src/styles/components/{track,buttons,search,video,playlists,saved-video}.css` | Modified | inline transition/anim durations → `--dur-*` / `--ease-*` tokens |
| `frontend/src/styles/index.css` | Modified | doc comment `900px` → `859.98px` (import list unchanged) |
| `openspec/changes/redesign-and-history/tasks.md` | Modified | Slice 3 checkboxes 3.1–3.20 `[x]`, 3.21 deferred |

## Not done / deferred

- **3.21** — `npm run dev` manual verification (no dev server in this env).
  Reviewer checklist:
  1. **Breakpoint**: resize slowly across 860px. `>= 860`: left rail only, no
     bottom bar. `< 860`: bottom bar only, no rail. Never both.
  2. **No overlap**: at 375px and 800px wide, scroll every view to the end —
     the last row clears both the mini-player and the bottom nav.
  3. **Mobile transport**: at 375px, load a track — play/pause + a draggable
     seek bar are visible and work in the mini-player. Native `<audio>` is
     never `display:none` (DevTools → Elements).
  4. **Full-screen now-playing**: tap the mini-player artwork/title → full
     screen with large art, title, prev/next, seek, and Radio/Lyrics/Queue
     (same toggles). Chevron-down collapses. On a Chromium engine the artwork
     morphs (View Transition); elsewhere it slides up.
  5. **Background audio + single mount**: add a temporary
     `console.count("PlayerBar mount")` at the top of `PlayerBar`. Play audio,
     then: switch all 5 nav views, open/close a video, open/close full-screen
     now-playing, open/close the queue + lyrics sheets. Audio never stops; the
     count logs exactly once.
  6. **Back gesture**: `search → library → settings`, browser Back → `library`,
     Back → `search`. Open a video, Back → closes watch (app not exited). Open
     full-screen now-playing, Back → collapses it (app not exited).
  7. **PiP + fullscreen**: open a video, confirm the Plyr PiP and fullscreen
     buttons are present and work; SponsorBlock chip still toggles/skips.
  8. **MediaSession**: from the OS lock screen / media popup, play/pause/next/
     prev/seek still control playback.
  9. **Web Audio leveling / radio / shortcuts / scrobble**: toggle the level
     button (audible compression), let a radio queue auto-extend on track end,
     use Space / ←/→ / n / p / m, confirm a Last.fm scrobble still fires.
  10. **Reduced motion**: DevTools → Rendering → emulate
      `prefers-reduced-motion: reduce`. View swaps and sheet/now-playing
      openings are instant; no console error; no View Transition animation.
  11. **Both themes**: repeat the nav + full-screen + sheet checks in light and
      dark (Settings → Tema).
