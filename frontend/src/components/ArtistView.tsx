import { useEffect, useState } from "react";

import { getArtist } from "../api";
import type { AlbumCard, Artist } from "../types";
import { usePlayer } from "../state/player";
import { useLibraryForArtist } from "../state/libraryArtist";
import { useListKeyboard } from "../lib/useListKeyboard";
import { shuffled } from "../lib/shuffle";
import Icon from "./Icon";
import LibraryForArtist from "./LibraryForArtist";
import TrackRow from "./TrackRow";

const TOP_SONGS = 10;

export default function ArtistView({
  browseId,
  onBack,
  onOpenAlbum,
  onOpenPlaylist,
}: {
  browseId: string;
  onBack: () => void;
  onOpenAlbum: (browseId: string) => void;
  onOpenPlaylist?: (id: string) => void;
}) {
  const [artist, setArtist] = useState<Artist | null>(null);
  const [failed, setFailed] = useState(false);
  const [allSongs, setAllSongs] = useState(false);
  const { playList, queueNext } = usePlayer();
  const mine = useLibraryForArtist(artist?.name);

  const shownSongs = artist
    ? allSongs
      ? artist.topSongs
      : artist.topSongs.slice(0, TOP_SONGS)
    : [];
  const { activeIndex, containerRef } = useListKeyboard(
    shownSongs.length,
    (i) => {
      if (artist) playList(artist.topSongs, i);
    },
  );

  useEffect(() => {
    let alive = true;
    setArtist(null);
    setFailed(false);
    setAllSongs(false);
    getArtist(browseId)
      .then((a) => {
        if (alive) setArtist(a);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [browseId]);

  const albumGrid = (title: string, cards: AlbumCard[]) =>
    cards.length > 0 && (
      <>
        <h2 className="view__subhead">{title}</h2>
        <div className="albumgrid">
          {cards.map((al) => (
            <button
              key={al.browseId}
              className="albumcard"
              onClick={() => onOpenAlbum(al.browseId)}
            >
              <span className="albumcard__art">
                {al.thumbnail ? (
                  <img src={al.thumbnail} alt="" loading="lazy" />
                ) : (
                  <Icon name="list" size={22} />
                )}
              </span>
              <span className="albumcard__title">{al.title}</span>
              <span className="albumcard__meta">
                {[al.type || "Álbum", al.year].filter(Boolean).join(" · ")}
              </span>
            </button>
          ))}
        </div>
      </>
    );

  return (
    <div className="view">
      <button className="watch__back" onClick={onBack}>
        <Icon name="back" size={16} /> Volver
      </button>

      {failed && (
        <p className="hint hint--error">No se pudo cargar el artista.</p>
      )}
      {!artist && !failed && <p className="hint">Cargando…</p>}

      {artist && (
        <>
          <div className="artisthead">
            <div className="artisthead__art">
              {artist.thumbnail ? (
                <img src={artist.thumbnail} alt="" />
              ) : (
                <Icon name="radio" size={34} />
              )}
            </div>
            <div className="artisthead__meta">
              <h1>{artist.name}</h1>
              {artist.topSongs.length > 0 && (
                <div className="artisthead__actions">
                  <button
                    className="btn btn--accent"
                    onClick={() => playList(artist.topSongs, 0)}
                  >
                    <Icon name="play" size={14} filled /> Reproducir
                  </button>
                  <button
                    className="btn"
                    onClick={() => playList(shuffled(artist.topSongs), 0)}
                  >
                    <Icon name="shuffle" size={14} /> Aleatorio
                  </button>
                  <button
                    className="btn btn--ghost"
                    onClick={() => queueNext(artist.topSongs)}
                    title="Añadir a la cola"
                  >
                    <Icon name="queue" size={14} /> A la cola
                  </button>
                </div>
              )}
            </div>
          </div>

          <LibraryForArtist match={mine} onOpenPlaylist={onOpenPlaylist} />

          {artist.topSongs.length > 0 && (
            <>
              <h2 className="view__subhead">Populares</h2>
              <div
                className="tracklist"
                ref={(el) => {
                  containerRef.current = el;
                }}
              >
                {shownSongs.map((track, i) => (
                  <TrackRow
                    key={track.id + i}
                    track={track}
                    index={i}
                    selected={i === activeIndex}
                    onPlay={() => playList(artist.topSongs, i)}
                  />
                ))}
              </div>
              {artist.topSongs.length > TOP_SONGS && (
                <button
                  className="btn btn--ghost artist__more"
                  onClick={() => setAllSongs((v) => !v)}
                >
                  {allSongs ? "Ver menos" : "Ver más"}
                </button>
              )}
            </>
          )}

          {albumGrid("Álbumes", artist.albums)}
          {albumGrid("Sencillos y EP", artist.singles)}
        </>
      )}
    </div>
  );
}
