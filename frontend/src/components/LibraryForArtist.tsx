import type { LibraryArtistMatch } from "../state/libraryArtist";
import Icon from "./Icon";

/**
 * Compact entry point to the user's own tracks by an artist. Renders nothing
 * when there are no matches; otherwise a single card that opens the full
 * "En tu biblioteca" list (Spotify-style — never an inline list that could grow
 * to dozens of rows).
 */
export default function LibraryForArtist({
  match,
  onOpen,
}: {
  match: LibraryArtistMatch;
  onOpen: (name: string) => void;
}) {
  if (match.tracks.length === 0) return null;

  const n = match.tracks.length;
  const bits: string[] = [`${n} ${n === 1 ? "canción" : "canciones"}`];
  if (match.savedCount > 0) bits.push(`${match.savedCount} en favoritos`);
  if (match.inPlaylists.length > 0) {
    const p = match.inPlaylists.length;
    bits.push(`${p} playlist${p === 1 ? "" : "s"}`);
  }

  return (
    <button
      type="button"
      className="libcard"
      onClick={() => onOpen(match.displayName)}
    >
      <span className="libcard__icon">
        <Icon name="heart" size={18} filled />
      </span>
      <span className="libcard__text">
        <span className="libcard__title">
          Tus canciones de {match.displayName}
        </span>
        <span className="libcard__sub">{bits.join(" · ")}</span>
      </span>
      <span className="libcard__chev" aria-hidden="true">
        <Icon name="back" size={16} />
      </span>
    </button>
  );
}
