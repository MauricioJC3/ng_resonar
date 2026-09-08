import { searchArtists } from "../api";

// Lets deep components (a track row, the player bar, the queue) jump to an
// artist without every intermediate component threading a callback. The shell
// (`AuthedApp`) registers the real navigators on mount.

let openArtist: ((browseId: string) => void) | null = null;
let openSearch: ((query: string) => void) | null = null;

export function registerAppNav(fns: {
  openArtist: (browseId: string) => void;
  openSearch: (query: string) => void;
}) {
  openArtist = fns.openArtist;
  openSearch = fns.openSearch;
  return () => {
    openArtist = null;
    openSearch = null;
  };
}

/**
 * Best-effort "go to this artist": resolve the name to a browseId via search and
 * open the artist page; if nothing matches, fall back to a normal search for the
 * name. Tracks only carry artist names, not ids, so a lookup is unavoidable.
 */
export async function goToArtist(name: string) {
  const n = name.trim();
  if (!n) return;
  try {
    const [hit] = await searchArtists(n);
    if (hit?.browseId && openArtist) {
      openArtist(hit.browseId);
      return;
    }
  } catch {
    /* fall through to search */
  }
  openSearch?.(n);
}
