# Delta for music-recommendations

## ADDED Requirements

### Requirement: GET /api/recommendations endpoint

The system SHALL expose `GET /api/recommendations?limit=` returning
`{"results": Track[]}` using the existing `Track` shape, so the client renders
results with the existing `TrackRow` and needs no new type. When `limit` is
provided, at most that many tracks SHALL be returned.

#### Scenario: Response uses the Track shape

- GIVEN history contains recorded plays
- WHEN `GET /api/recommendations` is called
- THEN each item in `results` has the `Track` fields (`id`, `title`, `artists`, `thumbnail`, ...)

### Requirement: History-seeded recommendation derivation

The system SHALL derive recommendations by taking the last 10–15 unique
`videoId`s from play history, fanning out `ytmusic.related(id, limit=15)`
concurrently across those seeds, excluding any candidate whose id already appears
in history, ranking the remainder by cross-seed frequency (candidates returned
for more seeds rank higher) and then by seed recency, and returning roughly the
top 30 as `Track` objects.

#### Scenario: Populated history yields ranked recommendations

- GIVEN history has 12 unique recently played `videoId`s
- WHEN `GET /api/recommendations` is called with a cold cache
- THEN `related` is queried for those seeds concurrently
- AND the response excludes ids already in history
- AND candidates returned by more seeds appear earlier than single-seed candidates

### Requirement: Ranked-result cache

The system SHALL cache the ranked recommendation list in `deps.cache` under key
`recs:v1:{hash of the sorted seed ids}` with a TTL of 1800 seconds. A request
whose seed set hashes to a live cache entry SHALL be served from cache without
re-querying `related`.

#### Scenario: Second call within TTL is served from cache

- GIVEN `GET /api/recommendations` was computed and cached
- WHEN it is called again within 1800s with an unchanged seed set
- THEN the cached list is returned and no new `related` calls are made

### Requirement: Per-seed related cache on /api/related

The currently-uncached `/api/related` handler in `routers/search.py` SHALL cache
each response in `deps.cache` under key `related:{id}` with a TTL of 3600
seconds, and the recommendation fan-out SHALL reuse this cache.

#### Scenario: /api/related responses are now cached

- GIVEN `/api/related/{id}` is requested twice within 3600s
- WHEN the second request arrives
- THEN it is served from the `related:{id}` cache entry without calling `ytmusic.related` again

### Requirement: Fallback to home feed

When play history is empty, or when every `related` call yields nothing, the
system SHALL return `ytmusic.home()` results as the recommendation payload.

#### Scenario: Empty history falls back to home

- GIVEN history has no entries
- WHEN `GET /api/recommendations` is called
- THEN the response is populated from `ytmusic.home()`

#### Scenario: Total related failure falls back to home

- GIVEN history has seeds but every `related` call returns an empty list
- WHEN `GET /api/recommendations` is called
- THEN the response falls back to `ytmusic.home()` rather than returning an empty list

#### Scenario: Partial related failure degrades gracefully

- GIVEN some seeds return `related` results and others fail or return nothing
- WHEN recommendations are computed
- THEN ranking proceeds from the successful seeds
- AND the request still returns `{"results": Track[]}` without error

### Requirement: Non-blocking client recommendations call

`frontend/src/api.ts` SHALL expose `recommendations()` that calls
`GET /api/recommendations` and uses `.catch(() => [])` so a failure yields an
empty list instead of surfacing an error.

#### Scenario: Recommendation fetch failure yields an empty list

- GIVEN `/api/recommendations` errors or times out
- WHEN `recommendations()` is called
- THEN it resolves to `[]` and no error is thrown

### Requirement: "For you" and "Recently played" sections in SearchView

`SearchView` SHALL render a "For you" section (from `GET /api/recommendations`)
above the existing `homeMusic()` feed, and a "Recently played" section (from
`GET /api/history`). Both SHALL use the existing `TrackRow` component. Each
section SHALL render its rows when it has data and SHALL be hidden (no empty
header, no layout gap) when it has none.

#### Scenario: Sections render when populated

- GIVEN recommendations and history both return items
- WHEN `SearchView` is shown
- THEN "For you" appears above the `homeMusic()` feed and "Recently played" appears
- AND both use `TrackRow` for their rows

#### Scenario: Sections hide cleanly when empty

- GIVEN recommendations and history both return empty
- WHEN `SearchView` is shown
- THEN neither the "For you" nor the "Recently played" header is rendered
- AND the `homeMusic()` feed layout has no leftover gap
