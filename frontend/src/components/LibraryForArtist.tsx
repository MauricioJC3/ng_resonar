import type { LibraryArtistMatch } from "../state/libraryArtist";
import { usePlayer } from "../state/player";
import TrackRow from "./TrackRow";

/**
 * "En tu biblioteca" — the user's own saved / playlisted tracks by an artist.
 * Renders nothing when there are no matches. Used on the artist page and, with
 * a `limit`, as a compact strip above the search results.
 */
export default function LibraryForArtist({
  match,
  limit,
  onOpenPlaylist,
}: {
  match: LibraryArtistMatch;
  limit?: number;
  onOpenPlaylist?: (id: string) => void;
}) {
  const { playList } = usePlayer();

  if (match.tracks.length === 0) return null;

  const shown =
    limit && match.tracks.length > limit
      ? match.tracks.slice(0, limit)
      : match.tracks;
  const hidden = match.tracks.length - shown.length;

  return (
    <section className="libartist">
      <h2 className="view__subhead">En tu biblioteca</h2>
      <div className="tracklist">
        {shown.map((track, i) => (
          <TrackRow
            key={track.id + i}
            track={track}
            index={i}
            onPlay={() => playList(match.tracks, i)}
          />
        ))}
      </div>

      {(match.savedCount > 0 || match.inPlaylists.length > 0 || hidden > 0) && (
        <p className="libartist__meta">
          {match.savedCount > 0 && (
            <span className="libartist__tag">
              {match.savedCount} en favoritos
            </span>
          )}
          {match.inPlaylists.map((p) =>
            onOpenPlaylist ? (
              <button
                key={p.id}
                type="button"
                className="libartist__tag libartist__tag--link"
                onClick={() => onOpenPlaylist(p.id)}
              >
                {p.name} · {p.count}
              </button>
            ) : (
              <span key={p.id} className="libartist__tag">
                {p.name} · {p.count}
              </span>
            ),
          )}
          {hidden > 0 && (
            <span className="libartist__tag">+{hidden} más</span>
          )}
        </p>
      )}
    </section>
  );
}
