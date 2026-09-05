import { useEffect, useState } from "react";

import { homeMusic, search } from "../api";
import type { Track } from "../types";
import { usePlayer } from "../state/player";
import SearchBox from "./SearchBox";
import TrackRow from "./TrackRow";

export default function SearchView() {
  const [results, setResults] = useState<Track[]>([]);
  const [home, setHome] = useState<Track[]>([]);
  const [status, setStatus] = useState<"empty" | "loading" | "idle" | "error">(
    "empty",
  );
  const [error, setError] = useState("");
  const { playList } = usePlayer();

  useEffect(() => {
    homeMusic().then(setHome);
  }, []);

  async function run(term: string) {
    setStatus("loading");
    setError("");
    try {
      setResults(await search(term));
      setStatus("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
      setStatus("error");
    }
  }

  const showHome = status === "empty" && home.length > 0;

  return (
    <div className="view">
      <SearchBox
        autoFocus
        placeholder="Buscar canciones, artistas, álbumes…"
        onSubmit={run}
      />

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

      {status === "idle" && results.length === 0 && (
        <p className="hint">Sin resultados.</p>
      )}

      {showHome && <h2 className="view__subhead">Escucha algo ahora</h2>}

      <div className="tracklist">
        {(status === "empty" ? home : results).map((track, i) => (
          <TrackRow
            key={track.id + i}
            track={track}
            index={i}
            onPlay={() =>
              playList(status === "empty" ? home : results, i)
            }
          />
        ))}
      </div>
    </div>
  );
}
