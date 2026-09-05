# Delta for responsive-navigation

## ADDED Requirements

### Requirement: Single responsive Nav component

The system SHALL replace the desktop-only sidebar with one `Nav` component that
renders as a left rail at or above a defined viewport breakpoint and as a fixed
bottom navigation bar below it. The navigation item set (the existing five
destinations) SHALL be unchanged, and only one presentation SHALL be visible at
any viewport width.

#### Scenario: Desktop shows the left rail

- GIVEN a viewport at or above the breakpoint
- WHEN the app renders
- THEN `Nav` is shown as a left rail with item labels
- AND no bottom navigation bar is present

#### Scenario: Mobile shows the bottom navigation

- GIVEN a viewport below the breakpoint
- WHEN the app renders
- THEN `Nav` is shown as a fixed bottom bar
- AND main content is padded so the bar never overlaps content

### Requirement: Built on the existing view-state model

The `Nav` component SHALL operate on the existing `App.tsx` `view` state
(`search | videos | playlists | library | settings`) plus the `watching` and
`openPlaylist` overlays. No routing library SHALL be introduced.

#### Scenario: Selecting a nav item changes the view state

- GIVEN the current view is `search`
- WHEN the user selects the `library` nav item
- THEN `App.tsx` `view` becomes `library` and any open overlay is cleared
- AND no `react-router` dependency exists in `frontend/package.json`

### Requirement: Full-screen now-playing and watch on mobile

On viewports below the breakpoint, the now-playing view and the watch view SHALL
render full-screen, covering the navigation and main content while open.

#### Scenario: Opening now-playing goes full-screen on mobile

- GIVEN a mobile viewport with audio playing
- WHEN the user expands the mini player
- THEN the now-playing view fills the viewport
- AND the bottom navigation is covered or hidden while it is open

#### Scenario: Opening watch goes full-screen on mobile

- GIVEN a mobile viewport
- WHEN the user opens a video in the watch view
- THEN the watch view fills the viewport

### Requirement: Restored mobile transport and seek control

The transport and seek control (currently hidden below 900px) SHALL be visible
and usable on mobile viewports, either as a mini-player transport or within the
full-screen now-playing view.

#### Scenario: Mobile shows a visible transport

- GIVEN a mobile viewport with a track loaded
- WHEN the player UI is shown
- THEN play/pause and a seekable progress control are visible and operable

### Requirement: Back gesture navigates via history

The system SHALL call `history.pushState` when the view or overlay changes and
SHALL handle `popstate` so that the browser or OS back gesture returns to the
previous view or closes the current overlay instead of exiting the app.

#### Scenario: Back gesture returns to the previous view

- GIVEN the user navigated `search` → `library` → `settings`
- WHEN the user performs the browser/OS back gesture
- THEN the view returns to `library`
- AND a second back gesture returns to `search`

#### Scenario: Back gesture closes a full-screen overlay first

- GIVEN the watch view is open over the `videos` view
- WHEN the user performs the back gesture
- THEN the watch view closes and the `videos` view is shown
- AND the app is not exited

### Requirement: Nav state and URL history stay in sync

The active `view`/overlay state and the browser history entry SHALL remain
consistent in both directions: state changes push history, and history
navigation updates state.

#### Scenario: State and history remain consistent

- GIVEN the user has navigated across several views and overlays
- WHEN they move backward and forward through history
- THEN the rendered view/overlay matches the history position at every step

### Requirement: URL deep-linking explicitly not required

The system is NOT required to support loading an arbitrary view or overlay
directly from a pasted or bookmarked URL. Deep links and shareable per-view URLs
are out of scope for this change.

#### Scenario: Deep link is not expected to resolve

- GIVEN a URL that encodes a specific view
- WHEN it is opened in a fresh session
- THEN the app MAY start at its default view
- AND no requirement is violated by not restoring the encoded view
