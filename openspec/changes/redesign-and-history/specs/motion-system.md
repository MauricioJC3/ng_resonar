# Delta for motion-system

## ADDED Requirements

### Requirement: Duration and easing tokens

The system SHALL define motion tokens as CSS custom properties: `--dur-fast`,
`--dur-base`, and `--dur-slow` with values inside a 220–320ms band (a shorter
`--dur-fast` for micro-interactions is permitted), plus `--ease-*` tokens for
standard, emphasized, and exit easing. Interactive-state transitions (hover,
focus, active, selection, row fades, sheet slide) SHALL reference these tokens
instead of hard-coded durations and easing.

#### Scenario: Motion tokens applied to interactive states

- GIVEN a component with a hover or focus transition
- WHEN its computed style is inspected
- THEN the transition duration and timing function resolve from `--dur-*` / `--ease-*` tokens
- AND the effective duration falls within the 220–320ms band (or the defined `--dur-fast` value)

### Requirement: Keyframes retained and consolidated

Existing `@keyframes` (equaliser, spinner, drawer-in) SHALL be retained, renamed
consistently where a name no longer fits (for example drawer-in → sheet-in), and
referenced by every element that previously used the original name.

#### Scenario: Renamed keyframe still drives its animations

- GIVEN the drawer-in keyframe is renamed to sheet-in
- WHEN the queue sheet, lyrics sheet, and skip flash render
- THEN each animates using the renamed keyframe with no visual regression

### Requirement: Global reduced-motion guard

The system SHALL include a global `@media (prefers-reduced-motion: reduce)` rule
that nullifies transitions and animations across all elements
(`*, *::before, *::after`) by forcing near-zero durations. No motion beyond an
instantaneous state change SHALL occur while the preference is set.

#### Scenario: Reduced-motion disables all motion

- GIVEN `prefers-reduced-motion: reduce` is set
- WHEN the user navigates views, opens a sheet, or hovers interactive elements
- THEN no transition or keyframe animation is perceptible
- AND view changes and sheet openings are instantaneous

### Requirement: Native View Transitions for view swaps and now-playing expand

When `document.startViewTransition` is available, the system SHALL wrap
`App.tsx` view-state changes in it, and SHALL assign a shared
`view-transition-name` to the now-playing artwork/title so the mini player
expands into the full-screen now-playing view as a shared-element transition.

#### Scenario: View Transitions used on a supporting engine

- GIVEN a browser that supports `document.startViewTransition`
- WHEN the user switches between views
- THEN the swap is animated through the View Transitions API
- AND expanding the mini player animates artwork and title as shared elements

### Requirement: Slide-up sheet fallback when unsupported

When `document.startViewTransition` is unavailable, the system SHALL fall back to
a CSS slide-up sheet transition (`translateY(100%)` → `0`) for the now-playing
expand and to an immediate (or CSS crossfade) swap for view changes, with no
scripting error and no dependency on the API.

#### Scenario: Fallback path on a non-supporting engine

- GIVEN a browser without `document.startViewTransition`
- WHEN the user opens the full-screen now-playing view
- THEN it enters via the CSS slide-up sheet transition
- AND view switches still work with no console error

#### Scenario: Fallback respects reduced-motion

- GIVEN a non-supporting browser with `prefers-reduced-motion: reduce`
- WHEN the now-playing view opens
- THEN it appears instantly with no slide animation

### Requirement: No animation library added

The motion system SHALL be implemented with CSS and the native View Transitions
API only. No animation or gesture library (for example framer-motion, motion,
GSAP) SHALL be added to `frontend/package.json`.

#### Scenario: Dependency manifest unchanged for animation libs

- GIVEN the change is applied
- WHEN `frontend/package.json` dependencies are inspected
- THEN no animation/gesture library has been introduced
