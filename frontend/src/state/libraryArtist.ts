import { useMemo } from "react";

import type { Track } from "../types";
import { trackByArtist } from "../lib/libraryMatch";
import { useLibrary } from "./library";
import { useAllPlaylistDetails } from "./playlists";

export interface LibraryArtistMatch {
  /** Deduped: the user's saved + playlisted tracks by this artist. */
  tracks: Track[];
  /** How many of `tracks` are in favourites. */
  savedCount: number;
  /** Which playlists hold tracks by this artist, and how many. */
  inPlaylists: { id: string; name: string; count: number }[];
}

const EMPTY: LibraryArtistMatch = {
  tracks: [],
  savedCount: 0,
  inPlaylists: [],
};

/**
 * "What do I already have by this artist?" — pure client-side filter over the
 * favourites store and every playlist's tracks. No API of its own beyond the
 * playlist details it asks `useAllPlaylistDetails` to load.
 */
export function useLibraryForArtist(
  name: string | null | undefined,
): LibraryArtistMatch {
  const favourites = useLibrary();
  const playlists = useAllPlaylistDetails(Boolean(name));

  return useMemo(() => {
    if (!name) return EMPTY;

    const byId = new Map<string, Track>();
    let savedCount = 0;
    for (const t of favourites) {
      if (trackByArtist(t, name)) {
        byId.set(t.id, t);
        savedCount += 1;
      }
    }

    const inPlaylists: LibraryArtistMatch["inPlaylists"] = [];
    for (const pl of playlists) {
      let count = 0;
      for (const t of pl.tracks) {
        if (trackByArtist(t, name)) {
          count += 1;
          if (!byId.has(t.id)) byId.set(t.id, t);
        }
      }
      if (count > 0) inPlaylists.push({ id: pl.id, name: pl.name, count });
    }

    if (byId.size === 0) return EMPTY;
    return { tracks: [...byId.values()], savedCount, inPlaylists };
  }, [favourites, playlists, name]);
}
