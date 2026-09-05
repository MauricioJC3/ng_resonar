# Delta for theme-system

## ADDED Requirements

### Requirement: Cool/serene design tokens as single source of truth

The system SHALL express all surface, line, text, accent, radius, and shadow
values as CSS custom properties on the root element, tuned to a calm "cool &
serene" palette (dark background near `#0E1414`, light background near `#F2F5F4`,
sage-teal accent near `#6DA89B`, blue-grey text ramp, diffuse multi-layer
shadows). Every raw color literal that currently bypasses a token (`#fff`, `#000`,
`rgba(0,0,0,*)` scrims, `#6d28d9`) MUST be promoted to a token so it re-themes
automatically.

#### Scenario: No unthemed color literals remain

- GIVEN the compiled stylesheet
- WHEN it is scanned for raw color literals inside rules that render visible UI
- THEN on-media text, stage backgrounds, and scrims resolve from tokens, not hard-coded values
- AND switching theme updates those surfaces without a stylesheet edit

### Requirement: Light and dark themes via `data-theme` on `<html>`

The system SHALL provide both a light and a dark theme. The active theme MUST be
selected by a `data-theme` attribute (`"light"` or `"dark"`) on the `<html>`
element. Token structure (per the approved visual mockup): the bare `:root` block
holds the **light** token set; the **dark** token set is redefined under
`@media (prefers-color-scheme: dark) :root:not([data-theme="light"])` and again
under an explicit `:root[data-theme="dark"]` block; `:root[data-theme="light"]`
re-asserts the light set so an explicit light choice wins over a dark OS. All
theme-swap scenarios below hold identically under this structure.

#### Scenario: Toggling the attribute swaps the palette

- GIVEN the app is rendered with `data-theme="dark"`
- WHEN `data-theme` is set to `"light"` on `<html>`
- THEN every `var(--*)`-driven surface repaints to the light palette
- AND no component remount or reload is required

### Requirement: First visit honours `prefers-color-scheme`

On a visit where no explicit theme choice is stored, the system SHALL apply the
theme matching the operating system `prefers-color-scheme` setting.

#### Scenario: First visit with OS in light mode

- GIVEN no `resonar:theme` value exists in `localStorage`
- AND the OS reports `prefers-color-scheme: light`
- WHEN the app loads
- THEN the light theme is applied

#### Scenario: First visit with OS in dark mode

- GIVEN no `resonar:theme` value exists in `localStorage`
- AND the OS reports `prefers-color-scheme: dark`
- WHEN the app loads
- THEN the dark theme is applied

### Requirement: Explicit choice persists and wins over system

When the user picks a theme, the system SHALL persist it to `localStorage` key
`resonar:theme` and MUST apply that stored choice on every subsequent load
regardless of the current `prefers-color-scheme` value. `localStorage` access
MUST be wrapped in try/catch.

#### Scenario: Toggle flips and persists

- GIVEN the current theme is dark
- WHEN the user activates the theme toggle
- THEN the theme becomes light
- AND `localStorage["resonar:theme"]` is `"light"`

#### Scenario: Reload keeps the explicit choice against opposite system setting

- GIVEN `resonar:theme` is `"light"` and the OS reports `prefers-color-scheme: dark`
- WHEN the app is reloaded
- THEN the light theme is applied

### Requirement: Pre-paint anti-FOUC script

The system SHALL run a small inline script in `<head>`, before the first paint
and before stylesheet-dependent rendering, that resolves the effective theme
(stored choice, else system preference) and sets `data-theme` on `<html>`.

#### Scenario: No flash of the wrong theme on load

- GIVEN `resonar:theme` is `"light"`
- WHEN the page loads on a slow connection
- THEN the first painted frame is already in the light theme
- AND no dark frame is shown before hydration

### Requirement: `color-scheme` declared per theme

Each theme SHALL declare a matching `color-scheme` value so that native form
controls, scrollbars, and range inputs adopt the correct rendering.

#### Scenario: Native controls match the active theme

- GIVEN the light theme is active
- WHEN a range input or scrollbar is rendered
- THEN it uses the light `color-scheme` UA styling

### Requirement: Per-theme Plyr token block

The system SHALL define a dedicated `--plyr-*` custom property block for each
theme so Plyr audio and video controls are legible and on-brand in both modes.

#### Scenario: Plyr controls themed in both modes

- GIVEN a Plyr player is mounted
- WHEN the theme is dark THEN Plyr control colors, menu background, and range track resolve from the dark `--plyr-*` block
- WHEN the theme is light THEN they resolve from the light `--plyr-*` block

### Requirement: Theme toggle in SettingsView

The system SHALL expose a theme toggle control in `SettingsView`, using
`sun`/`moon` glyphs added to the `Icon` component. Activating it changes the
theme and persists the choice per the persistence requirement above.

#### Scenario: Toggle control reflects current state

- GIVEN the dark theme is active
- WHEN `SettingsView` is opened
- THEN the toggle indicates the dark state
- AND activating it switches to light and updates the indicator

### Requirement: PWA color and asset sync

When the palette changes, the system SHALL keep PWA assets in sync:
`index.html` `theme-color` metas MUST include a default (dark) value and a
`media="(prefers-color-scheme: light)"` value and MUST be updated at runtime by
the toggle; `manifest.webmanifest` `background_color` and `theme_color` MUST use
the new palette; `sw.js` `CACHE` constant MUST be bumped (`resonar-shell-v1` →
`-v2`); the 6 app icons (`icon.svg`, `icon-maskable.svg`, `icon-192.png`,
`icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`) MUST be
regenerated to the sage-teal brand glyph.

#### Scenario: Installed PWA picks up the new shell

- GIVEN a previously installed PWA holding the `resonar-shell-v1` cache
- WHEN the redesigned build is deployed with `CACHE` bumped to `-v2`
- THEN the service worker `activate` handler purges the old cache
- AND the client loads the new palette, metas, and icons

#### Scenario: Runtime theme-color follows the toggle

- GIVEN the app is running in dark theme with the dark `theme-color` meta active
- WHEN the user switches to light
- THEN the active `theme-color` meta value is updated to the light palette color

### Requirement: Theme is independent of reduced-motion

Changing the theme SHALL NOT enable, disable, or alter any transition or
animation behaviour; motion is governed solely by the motion-system
`prefers-reduced-motion` guard.

#### Scenario: Reduced-motion unaffected by theme

- GIVEN `prefers-reduced-motion: reduce` is set
- WHEN the user toggles between light and dark
- THEN no transition or animation plays as a result of the theme change
- AND motion behaviour is identical in both themes
