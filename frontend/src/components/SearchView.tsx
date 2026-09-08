import { useEffect, useState } from "react";

import { homeMusic, search, searchAlbums, searchArtists } from "../api";
import type { Track } from "../types";
import { usePlayer } from "../state/player";
import { musicHistoryGo, setMusicSearch, useSearchStore } from "../state/search";
import { useListKeyboard } from "../lib/useListKeyboard";
import Icon from "./Icon";
import SearchBox from "./SearchBox";
import TrackRow from "./TrackRow";

type NavDir = "" | "back" | "fwd";

export default function SearchView({
  onOpenArtist,
  onOpenAlbum,
}: {
  onOpenArtist: (browseId: string) => void;
  onOpenAlbum: (browseId: string) => void;
}) {
  const { music } = useSearchStore();
  const [home, setHome] = useState<Track[]>([]);
  const [status, setStatus] = useState<"empty" | "loading" | "idle" | "error">(
    music.query ? "idle" : "empty",
  );
  const [error, setError] = useState("");
  const [navDir, setNavDir] = useState<NavDir>("");
  const { playList } = usePlayer();

  useEffect(() => {
    homeMusic().then(setHome);
  }, []);

  async function run(term: string, push = true) {
    if (push) setNavDir("");
    setStatus("loading");
    setError("");
    try {
      const [songs, artists, albums] = await Promise.all([
        search(term),
        searchArtists(term),
        searchAlbums(term),
      ]);
      setMusicSearch({ query: term, songs, artists, albums }, push);
      setStatus("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
      setStatus("error");
    }
  }

  function stepHistory(delta: number) {
    const term = musicHistoryGo(delta);
    if (!term) return;
    setNavDir(delta < 0 ? "back" : "fwd");
    run(term, false);
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

      <div
        className={"searchresults" + (navDir ? ` searchresults--${navDir}` : "")}
        key={`${music.cursor}|${music.query}`}
      >
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
