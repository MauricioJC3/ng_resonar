import { useEffect, useState } from "react";

import { getAlbum } from "../api";
import type { Album } from "../types";
import { usePlayer } from "../state/player";
import Icon from "./Icon";
import TrackRow from "./TrackRow";

export default function AlbumView({
  browseId,
  onBack,
}: {
  browseId: string;
  onBack: () => void;
}) {
  const [album, setAlbum] = useState<Album | null>(null);
  const [failed, setFailed] = useState(false);
  const { playList } = usePlayer();

  useEffect(() => {
    let alive = true;
    setAlbum(null);
    setFailed(false);
    getAlbum(browseId)
      .then((a) => {
        if (alive) setAlbum(a);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [browseId]);

  return (
    <div className="view">
      <button className="watch__back" onClick={onBack}>
        <Icon name="back" size={16} /> Volver
      </button>

      {failed && (
        <p className="hint hint--error">No se pudo cargar el álbum.</p>
      )}

      {!album && !failed && <p className="hint">Cargando…</p>}

      {album && (
        <>
          <div className="pldetail__head">
            <div className="pldetail__art">
              {album.thumbnail ? (
                <img src={album.thumbnail} alt="" />
              ) : (
                <Icon name="list" size={30} />
              )}
            </div>
            <div className="pldetail__meta">
              <h1>{album.title}</h1>
              <p>
                {[
                  album.artists.join(", "),
                  album.year,
                  `${album.tracks.length} pistas`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <div className="pldetail__actions">
                <button
                  className="btn btn--accent"
                  disabled={!album.tracks.length}
                  onClick={() => playList(album.tracks, 0)}
                >
                  <Icon name="play" size={14} filled /> Reproducir
                </button>
              </div>
            </div>
          </div>

          {album.tracks.length === 0 ? (
            <div className="empty">
              <p>No se encontraron pistas para este álbum.</p>
            </div>
          ) : (
            <div className="tracklist">
              {album.tracks.map((track, i) => (
                <TrackRow
                  key={track.id + i}
                  track={track}
                  index={i}
                  onPlay={() => playList(album.tracks, i)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
