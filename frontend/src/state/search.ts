import { useSyncExternalStore } from "react";

import type { AlbumCard, ArtistCard, Track, VideoItem } from "../types";

// In-memory cache of the last music / video search so that leaving a results
// list (opening a video, then Back) restores it instead of dropping the user
// back on "trending" / "home". Not persisted across a reload — that's fine, a
// reload is a fresh session. Wiped on logout via state/reset.ts.
//
// Each side also keeps a navigable history of the queries that were run, so the
// search views can offer ‹ / › buttons to step back and forward through past
// searches (independent of the browser Back gesture, which moves between app
// views).

interface MusicResults {
  query: string;
  songs: Track[];
  artists: ArtistCard[];
  albums: AlbumCard[];
}

interface VideoResults {
  query: string;
  results: VideoItem[];
}

interface History {
  history: string[];
  cursor: number;
}

type MusicSearch = MusicResults & History;
type VideoSearch = VideoResults & History;

interface SearchState {
  music: MusicSearch;
  video: VideoSearch;
}

const EMPTY: SearchState = {
  music: { query: "", songs: [], artists: [], albums: [], history: [], cursor: -1 },
  video: { query: "", results: [], history: [], cursor: -1 },
};

let snapshot: SearchState = EMPTY;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export function useSearchStore(): SearchState {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot,
  );
}

/** Append `query` to a history, dropping any entries ahead of the cursor. */
function pushHistory(h: History, query: string): History {
  if (!query || h.history[h.cursor] === query) return h;
  const history = [...h.history.slice(0, h.cursor + 1), query];
  return { history, cursor: history.length - 1 };
}

/**
 * Store a fresh music search. `push` is true for a search the user just ran
 * (extends the history) and false when we're replaying a history entry.
 */
export function setMusicSearch(results: MusicResults, push = true) {
  const nav = push
    ? pushHistory(snapshot.music, results.query)
    : { history: snapshot.music.history, cursor: snapshot.music.cursor };
  snapshot = { ...snapshot, music: { ...results, ...nav } };
  emit();
}

export function setVideoSearch(results: VideoResults, push = true) {
  const nav = push
    ? pushHistory(snapshot.video, results.query)
    : { history: snapshot.video.history, cursor: snapshot.video.cursor };
  snapshot = { ...snapshot, video: { ...results, ...nav } };
  emit();
}

/**
 * Move the music history cursor by `delta` (−1 back, +1 forward). Returns the
 * query at the new position, or null when the move is out of range.
 */
export function musicHistoryGo(delta: number): string | null {
  const { history, cursor } = snapshot.music;
  const next = cursor + delta;
  if (next < 0 || next >= history.length) return null;
  snapshot = { ...snapshot, music: { ...snapshot.music, cursor: next } };
  emit();
  return history[next];
}

export function videoHistoryGo(delta: number): string | null {
  const { history, cursor } = snapshot.video;
  const next = cursor + delta;
  if (next < 0 || next >= history.length) return null;
  snapshot = { ...snapshot, video: { ...snapshot.video, cursor: next } };
  emit();
  return history[next];
}

export function resetSearch() {
  snapshot = EMPTY;
  emit();
}

// Uniform name for the state/reset.ts aggregator.
export { resetSearch as reset };
