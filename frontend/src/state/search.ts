import { useSyncExternalStore } from "react";

import type { AlbumCard, ArtistCard, Track, VideoItem } from "../types";

// In-memory cache of the last music / video search so that leaving a results
// list (opening a video, then Back) restores it instead of dropping the user
// back on "trending" / "home". Not persisted across a reload — that's fine, a
// reload is a fresh session. Wiped on logout via state/reset.ts.
//
// Each side keeps the FULL results of every query it has run, so the ‹ / ›
// buttons in the search views step back and forward instantly, with no refetch
// (independent of the browser Back gesture, which moves between app views).

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

interface History<T> {
  history: T[];
  cursor: number;
}

type MusicSearch = MusicResults & History<MusicResults>;
type VideoSearch = VideoResults & History<VideoResults>;

interface SearchState {
  music: MusicSearch;
  video: VideoSearch;
  /** A query the shell asked the Search view to run (e.g. "go to artist" fallback). */
  pending: string | null;
}

const EMPTY_MUSIC: MusicResults = { query: "", songs: [], artists: [], albums: [] };
const EMPTY_VIDEO: VideoResults = { query: "", results: [] };

const EMPTY: SearchState = {
  music: { ...EMPTY_MUSIC, history: [], cursor: -1 },
  video: { ...EMPTY_VIDEO, history: [], cursor: -1 },
  pending: null,
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

/**
 * Record a fresh set of results. Extends the history: re-running the current
 * query replaces its entry in place; a new query drops anything ahead of the
 * cursor and appends.
 */
function record<T extends { query: string }>(
  h: History<T>,
  entry: T,
): History<T> {
  const atCursor = h.history[h.cursor];
  if (atCursor && atCursor.query === entry.query) {
    const history = h.history.slice();
    history[h.cursor] = entry;
    return { history, cursor: h.cursor };
  }
  const history = [...h.history.slice(0, h.cursor + 1), entry];
  return { history, cursor: history.length - 1 };
}

export function setMusicSearch(results: MusicResults) {
  const nav = record(snapshot.music, results);
  snapshot = { ...snapshot, music: { ...results, ...nav } };
  emit();
}

export function setVideoSearch(results: VideoResults) {
  const nav = record(snapshot.video, results);
  snapshot = { ...snapshot, video: { ...results, ...nav } };
  emit();
}

/**
 * Step the music history cursor by `delta` (−1 back, +1 forward) and show that
 * entry's cached results immediately. Returns the entry, or null if out of range.
 */
export function musicHistoryGo(delta: number): MusicResults | null {
  const { history, cursor } = snapshot.music;
  const next = cursor + delta;
  if (next < 0 || next >= history.length) return null;
  const entry = history[next];
  snapshot = { ...snapshot, music: { ...entry, history, cursor: next } };
  emit();
  return entry;
}

export function videoHistoryGo(delta: number): VideoResults | null {
  const { history, cursor } = snapshot.video;
  const next = cursor + delta;
  if (next < 0 || next >= history.length) return null;
  const entry = history[next];
  snapshot = { ...snapshot, video: { ...entry, history, cursor: next } };
  emit();
  return entry;
}

/** Ask the Search view to run `query` (used by the "go to artist" fallback). */
export function requestSearch(query: string) {
  const q = query.trim();
  if (!q) return;
  snapshot = { ...snapshot, pending: q };
  emit();
}

/** The Search view calls this once it has picked up the pending query. */
export function clearPendingSearch() {
  if (snapshot.pending === null) return;
  snapshot = { ...snapshot, pending: null };
  emit();
}

export function resetSearch() {
  snapshot = EMPTY;
  emit();
}

// Uniform name for the state/reset.ts aggregator.
export { resetSearch as reset };
