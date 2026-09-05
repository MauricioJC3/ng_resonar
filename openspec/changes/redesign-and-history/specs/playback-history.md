# Delta for playback-history

## ADDED Requirements

### Requirement: Backend-persisted history service

The system SHALL persist play history on the backend in a new
`backend/app/services/history.py` that mirrors `services/playlists.py`: module
level functions (no class), a `threading.Lock` guarding every mutation, a
tolerant `_load()`, an atomic `_save()` that writes a temp file then
`os.replace`, `json.dump(..., ensure_ascii=False)`, and an `ensure()` that
creates `data_dir` and seeds the file, called from the `main.py` lifespan
handler. The file SHALL be `./data/history.json` (under `settings.data_dir`) with
shape `{"entries": [...]}`.

#### Scenario: File seeded on startup

- GIVEN `./data/history.json` does not exist
- WHEN the backend starts and the lifespan handler runs `ensure()`
- THEN `./data/history.json` exists containing `{"entries": []}`

#### Scenario: History survives a backend restart

- GIVEN entries have been written to `./data/history.json`
- WHEN the backend process is stopped and started again
- THEN `GET /api/history` returns the previously written entries

### Requirement: HistoryEntry shape

A stored history entry SHALL have fields: `videoId` (string, required), `title`
(string, required), `artist` (string, optional), `thumbnail` (string, optional),
`kind` (`"song"` or `"video"`), `playedAt` (epoch seconds, integer), `playCount`
(integer), and `source` (string, optional). Field names SHALL be camelCase.

#### Scenario: Stored entry carries the full shape

- GIVEN a valid `POST /api/history` for a song
- WHEN the entry is persisted
- THEN it contains `videoId`, `title`, `kind`, `playedAt`, and `playCount`
- AND `artist`, `thumbnail`, and `source` are present or null

### Requirement: GET /api/history returns newest-first

`GET /api/history?limit=` SHALL return `{"results": HistoryEntry[]}` ordered by
`playedAt` descending. When `limit` is provided, at most that many entries SHALL
be returned.

#### Scenario: Play a song then read history

- GIVEN an empty history
- WHEN a song is recorded and `GET /api/history` is called
- THEN `results` contains exactly one entry for that song
- AND its `playCount` is 1

#### Scenario: Limit caps the response

- GIVEN history holds 40 entries
- WHEN `GET /api/history?limit=10` is called
- THEN `results` contains the 10 most recent entries, newest first

### Requirement: POST /api/history stamps server-side fields

`POST /api/history` SHALL accept a body WITHOUT `playedAt` or `playCount`. The
server SHALL stamp `playedAt` with the current epoch seconds and set
`playCount` to 1 for a new entry, then return the stored entry.

#### Scenario: Client omits timestamp and count

- GIVEN a `POST /api/history` body with `videoId`, `title`, `kind`, and no `playedAt`/`playCount`
- WHEN the request is processed
- THEN the response entry has a server-stamped `playedAt` and `playCount` of 1

### Requirement: Consecutive-repeat dedupe

When the newest existing entry has the same `videoId` as an incoming
`POST /api/history`, the system SHALL bump that entry's `playedAt` to now and
increment its `playCount` instead of appending a new entry.

#### Scenario: Play the same song twice in a row

- GIVEN a song was just recorded
- WHEN the same `videoId` is recorded again with no different `videoId` in between
- THEN history still holds one entry for that song
- AND its `playCount` is 2 and its `playedAt` is updated

#### Scenario: A different song in between breaks the streak

- GIVEN songs recorded in order A, B, A
- WHEN history is read
- THEN there are entries for B and A, and the second A did not merge into the first A

### Requirement: Entry cap enforced on write

The system SHALL cap `history.json` at a fixed maximum between roughly 500 and
1000 entries. On any write that would exceed the cap, the oldest entries SHALL be
dropped so the stored count stays at or below the cap.

#### Scenario: Cap enforced

- GIVEN history is at the cap
- WHEN a new distinct entry is recorded
- THEN the total stored count does not exceed the cap
- AND the oldest entry has been removed

### Requirement: DELETE /api/history clears all

`DELETE /api/history` SHALL remove every entry, leaving `{"entries": []}`.

#### Scenario: Delete empties history

- GIVEN history holds several entries
- WHEN `DELETE /api/history` is called
- THEN it succeeds and a subsequent `GET /api/history` returns an empty `results` array

### Requirement: Invalid POST rejected with 4xx

A `POST /api/history` with a malformed body (missing required `videoId` or
`title`, wrong types) or an oversized payload SHALL be rejected with a 4xx status
and SHALL NOT be persisted.

#### Scenario: Malformed body rejected

- GIVEN a `POST /api/history` body missing `videoId`
- WHEN the request is processed
- THEN the response status is 4xx and history is unchanged

#### Scenario: Oversized payload rejected

- GIVEN a `POST /api/history` body exceeding the accepted size limit
- WHEN the request is processed
- THEN the response status is 4xx and no entry is stored

### Requirement: Fire-and-forget client recording

`frontend/src/api.ts` SHALL expose `recordPlay(item, kind, source?)` that issues
a non-blocking `POST /api/history` and swallows any network error. It SHALL be
called from `PlayerBar.tsx` (in the `useEffect` on `current`, beside
`scrobbleNowPlaying`) for songs and from `WatchView.tsx` (on the Plyr `play`
event) for videos. A play SHALL be recorded on playback start.

#### Scenario: Playing a song records a play

- GIVEN a song becomes the current track in `PlayerBar`
- WHEN playback starts
- THEN `recordPlay` posts the song to `/api/history`

#### Scenario: Playing a video records a play

- GIVEN a video is playing in `WatchView`
- WHEN the Plyr `play` event fires
- THEN `recordPlay` posts the video to `/api/history`

#### Scenario: Recording failure never surfaces to the user

- GIVEN the backend is unreachable or returns an error
- WHEN `recordPlay` runs
- THEN no error is thrown, no UI error is shown, and playback is unaffected
