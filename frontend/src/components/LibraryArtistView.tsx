import { useLibraryForArtist } from "../state/libraryArtist";
import { usePlayer } from "../state/player";
import { useListKeyboard } from "../lib/useListKeyboard";
import { shuffled } from "../lib/shuffle";
import Icon from "./Icon";
import TrackRow from "./TrackRow";

/**
 * The full "En tu biblioteca · <artista>" list: every track the user has saved
 * to favourites or added to a playlist by that artist, with play / shuffle /
 * queue actions. Opened from the compact card in the artist page and search.
 */
export default function LibraryArtistView({
  name,
  onBack,
  onOpenPlaylist,
}: {
  name: string;
  onBack: () => void;
  onOpenPlaylist?: (id: string) => void;
}) {
  const mine = useLibraryForArtist(name);
  const { playList, queueNext } = usePlayer();
  const { activeIndex, containerRef } = useListKeyboard(
    mine.tracks.length,
    (i) => playList(mine.tracks, i),
  );

  const label = mine.displayName || name;
  const n = mine.tracks.length;

  return (
    <div className="view">
      <button className="watch__back" onClick={onBack}>
        <Icon name="back" size={16} /> Volver
      </button>

      <div className="pldetail__head">
        <div className="pldetail__art pldetail__art--lib">
          <Icon name="heart" size={30} filled />
        </div>
        <div className="pldetail__meta">
          <h1>En tu biblioteca</h1>
          <p>
            {label} · {n} {n === 1 ? "canción" : "canciones"}
          </p>
          <div className="pldetail__actions">
            <button
              className="btn btn--accent"
              disabled={n === 0}
              onClick={() => playList(mine.tracks, 0)}
            >
              <Icon name="play" size={14} filled /> Reproducir
            </button>
            <button
              className="btn"
              disabled={n === 0}
              onClick={() => playList(shuffled(mine.tracks), 0)}
            >
              <Icon name="shuffle" size={14} /> Aleatorio
            </button>
            <button
              className="btn btn--ghost"
              disabled={n === 0}
              onClick={() => queueNext(mine.tracks)}
              title="Añadir todas a la cola"
            >
              <Icon name="queue" size={14} /> A la cola
            </button>
          </div>
          {(mine.savedCount > 0 || mine.inPlaylists.length > 0) && (
            <p className="libartist__meta">
              {mine.savedCount > 0 && (
                <span className="libartist__tag">
                  {mine.savedCount} en favoritos
                </span>
              )}
              {mine.inPlaylists.map((p) =>
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
            </p>
          )}
        </div>
      </div>

      {n === 0 ? (
        <div className="empty">
          <p>No tienes canciones guardadas de {label}.</p>
          <p className="empty__sub">
            Marca canciones con ♥ o añádelas a una playlist y aparecerán aquí.
          </p>
        </div>
      ) : (
        <div
          className="tracklist"
          ref={(el) => {
            containerRef.current = el;
          }}
        >
          {mine.tracks.map((track, i) => (
            <TrackRow
              key={track.id + i}
              track={track}
              index={i}
              selected={i === activeIndex}
              onPlay={() => playList(mine.tracks, i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
