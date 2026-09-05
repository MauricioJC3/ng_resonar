# Delivery — `redesign-and-history`

**Status:** merged to `main` and pushed to `origin`
(`github.com:MauricioJC3/ng_resonar`), fast-forward `cc9dd46..ab599fb`
(15 commits). Verified running via `docker compose up --build` on
`localhost:8080`; new endpoints smoke-tested with `curl`.

> Engram MCP was unavailable for the whole build session
> (`CONNECTION_CLOSED`), so every SDD artifact lives here as a committed
> file, not in engram: `explore.md`, `proposal.md`, `specs/*.md`,
> `design.md`, `tasks.md`, `apply-progress.md`, this file. Import into
> engram from a session where the server is reachable.

## What shipped

| # | Commit | Scope |
|---|--------|-------|
| 1 | `d53292b` | Cool/serene design tokens + light/dark theming via `data-theme`, motion tokens, Fraunces + Hanken Grotesk, PWA colour sync |
| 2 | `ea1106f` | Mechanical split of `styles.css` (1870 lines) into `styles/**` |
| 3 | `a915db7` | Responsive `Nav` (rail ≥860px / bottom-nav below), full-screen now-playing + watch, native View Transitions, `pushState`/`popstate` back button |
| 4 | `b1c5b51` | Restyle every view to the new language |
| 5 | `bed82f7` | Backend playback history (`services/history.py` + `routers/history.py`, `data/history.json`, cap 800, dedupe) + `recordPlay` hooks |
| 6 | `21cd18e` | History-seeded recommendations (`services/recommend.py` + `routers/recommendations.py`), `related:{id}` + `recs:v1:{hash}` caches, "For you" UI |
| — | `73165d8` | Stop tracking `.atl/` |
| — | `e6d5236` | `sw.js` cache → v3 |
| — | `81056e8` | Watch-view polish (full-width stage, HD badge, Fraunces title) |
| — | `b4cd6b7` | Dedicated **Inicio** view (card-grid "Para ti" + "Reproducido recientemente" + home feed); now the default landing |
| — | `ae64477` | Import YouTube Mix/radio (`RD…`) playlist URLs |
| — | `ae841a7` | Delete playlist from the grid; import de-dupe + `i.ytimg.com` thumbnail fallback (fixes blank tiles) |
| — | `6557313` | Normalise apostrophes/qualifiers when de-duping Mix imports |
| — | `ab599fb` | Favourite (heart) toggle in the queue rows and the player action bar |

## Locked decisions

- Palette: dark `--bg #0E1414` / `--accent #6DA89B`; light `--bg #F1F4F3` /
  `--accent #3E7A6E`. Radii 10/14/999. Motion 140/240/320 ms.
- Nav breakpoint **860 px**. No `react-router` (hand-rolled `view` state +
  `pushState`). History cap **800**, consecutive-repeat dedupe.
- Recommendations: **12** seeds, `related(id, 15)` fan-out, `wait_for 4 s`,
  cap **30**, TTL 1800 s (+ `related:{id}` TTL 3600 s), `home()` fallback.
- `recordPlay` records **on start**; sources `"player"` / `"watch"`.
- Mix imports capped at 50; aggressive title-dedupe **only** for mixes.

## Not done — needs a dev environment

- Regenerate the 4 PNG icons (`icon-192`, `icon-512`, `icon-maskable-512`,
  `apple-touch-icon`) from the sage SVGs — recipe in `apply-progress.md`.
- Run the pytest suites: `cd backend && pip install -r requirements-dev.txt
  && pytest` (`test_history_service.py`, `test_history_router.py`,
  `test_recommend.py`). No runner in CI.
- `test_recommendations_router.py` (task 6.10) not written.
- Manual `npm run dev` / uvicorn passes: tasks 1.18, 2.9, 3.21, 4.12, 5.18,
  6.11, 6.12 (checklists in `apply-progress.md`).

## Known, not a bug

A YouTube Mix seeded by one song returns many covers of it by different
artists; dedupe keeps them (distinct `(title, artist)`). Add title-only
dedupe if unwanted.
