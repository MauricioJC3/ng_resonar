import { useSyncExternalStore } from "react";

import type { AlbumCard, ArtistCard, Track, VideoItem } from "../types";

// In-memory cache of the last music / video search so that leaving a results
// list (opening a video, then Back) restores it instead of dropping the user
// back on "trending" / "home". Not persisted across a reload — that's fine, a
// reload is a fresh session. Wiped on logout via state/reset.ts.

interface MusicSearch {
  query: string;
  songs: Track[];
  artists: ArtistCard[];
  albums: AlbumCard[];
}

interface VideoSearch {
  query: string;
  results: VideoItem[];
}

interface SearchState {
  music: MusicSearch;
  video: VideoSearch;
}

const EMPTY: SearchState = {
  music: { query: "", songs: [], artists: [], albums: [] },
  video: { query: "", results: [] },
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

export function setMusicSearch(music: MusicSearch) {
  snapshot = { ...snapshot, music };
  emit();
}

export function setVideoSearch(video: VideoSearch) {
  snapshot = { ...snapshot, video };
  emit();
}

export function resetSearch() {
  snapshot = EMPTY;
  emit();
}

// Uniform name for the state/reset.ts aggregator.
export { resetSearch as reset };
