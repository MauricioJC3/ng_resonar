import { useEffect, useRef, useState } from "react";

import { homeMusic, search, searchAlbums, searchArtists } from "../api";
import type { Track } from "../types";
import { usePlayer } from "../state/player";
import { useLibraryForArtist } from "../state/libraryArtist";
import {
  clearPendingSearch,
  musicHistoryGo,
  setMusicSearch,
  useSearchStore,
} from "../state/search";
import { useListKeyboard } from "../lib/useListKeyboard";
import { swapWithTransition } from "../lib/viewTransition";
import Icon from "./Icon";
import LibraryForArtist from "./LibraryForArtist";
import SearchBox from "./SearchBox";
import TrackRow from "./TrackRow";

export default function SearchView({
  onOpenArtist,
  onOpenAlbum,
  onOpenLibArtist,
}: {
  onOpenArtist: (browseId: string) => void;
  onOpenAlbum: (browseId: string) => void;
  onOpenLibArtist: (name: string) => void;
}) {
  const { music, pending } = useSearchStore();
  const [home, setHome] = useState<Track[]>([]);
  const [status, setStatus] = useState<"empty" | "loading" | "idle" | "error">(
    music.query ? "idle" : "empty",
  );
  const [error, setError] = useState("");
  const resultsRef = useRef<HTMLDivElement>(null);
  const { playList } = usePlayer();

  useEffect(() => {
    homeMusic().then(setHome);
  }, []);

  // A "go to artist" that couldn't resolve a page lands here with a pending query.
  useEffect(() => {
    if (!pending) return;
    clearPendingSearch();
    run(pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  async function run(term: string) {
    setStatus("loading");
    setError("");
    try {
      const [songs, artists, albums] = await Promise.all([
        search(term),
        searchArtists(term),
        searchAlbums(term),
      ]);
      setMusicSearch({ query: term, songs, artists, albums });
      setStatus("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
      setStatus("error");
    }
  }

  // Cached results — the swap is instant, so it can ride a View Transition.
  function stepHistory(delta: number) {
    swapWithTransition(
      resultsRef.current,
      delta < 0 ? "sr-back" : "sr-fwd",
      () => {
        if (musicHistoryGo(delta)) setStatus("idle");
      },
    );
  }

  const showHome = status === "empty" && home.length > 0;
  const songs = status === "empty" ? home : music.songs;
  const nothing =
    status === "idle" &&
    music.songs.length === 0 &&
    music.artists.length === 0 &&
    music.albums.length === 0;

  const { activeIndex, containerRef } = useListKeyboard(songs.length, (i) =>
    playList(songs, i),
  );

  const canBack = music.cursor > 0;
  const canForward = music.cursor < music.history.length - 1;

  // Your own saved / playlisted songs matching what you searched for.
  const mine = useLibraryForArtist(status === "idle" ? music.query : null);

  return (
    <div className="view">
      <div className="searchrow">
        <div className="searchrow__nav">
          <button
            type="button"
            aria-label="Búsqueda anterior"
            title="Búsqueda anterior"
            disabled={!canBack}
            onClick={() => stepHistory(-1)}
          >
            <Icon name="back" size={18} />
          </button>
          <button
            type="button"
            className="searchrow__fwd"
            aria-label="Búsqueda siguiente"
            title="Búsqueda siguiente"
            disabled={!canForward}
            onClick={() => stepHistory(1)}
          >
            <Icon name="back" size={18} />
          </button>
        </div>
        <SearchBox
          autoFocus
          placeholder="Buscar canciones, artistas, álbumes…"
          onSubmit={run}
          query={music.query}
        />
      </div>

      {status === "loading" && <p className="hint">Buscando…</p>}
      {status === "error" && (
        <p className="hint hint--error">No se pudo buscar: {error}</p>
      )}

      {status === "empty" && home.length === 0 && (
        <div className="empty">
          <p>Escribe algo y pulsa Enter para empezar.</p>
          <p className="empty__sub">
            Los resultados vienen de YouTube Music. La reproducción es sin
            anuncios.
          </p>
        </div>
      )}

      {nothing && <p className="hint">Sin resultados.</p>}

      <div className="searchresults" ref={resultsRef}>
        {status === "idle" && (
          <LibraryForArtist match={mine} onOpen={onOpenLibArtist} />
        )}

        {status === "idle" && music.artists.length > 0 && (
          <>
            <h2 className="view__subhead">Artistas</h2>
            <div className="artistrow">
              {music.artists.map((a) => (
                <button
                  key={a.browseId}
                  className="artistcard"
                  onClick={() => onOpenArtist(a.browseId)}
                >
                  <span className="artistcard__art">
                    {a.thumbnail ? (
                      <img src={a.thumbnail} alt="" loading="lazy" />
                    ) : (
                      <Icon name="radio" size={22} />
                    )}
                  </span>
                  <span className="artistcard__name">{a.name}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {status === "idle" && music.albums.length > 0 && (
          <>
            <h2 className="view__subhead">Álbumes</h2>
            <div className="albumgrid">
              {music.albums.map((al) => (
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
        )}

        {showHome && <h2 className="view__subhead">Escucha algo ahora</h2>}
        {status === "idle" && music.songs.length > 0 && (
          <h2 className="view__subhead">Canciones</h2>
        )}

        <div
          className="tracklist"
          ref={(el) => {
            containerRef.current = el;
          }}
        >
          {songs.map((track, i) => (
            <TrackRow
              key={track.id + i}
              track={track}
              index={i}
              selected={i === activeIndex}
              onPlay={() => playList(songs, i)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
