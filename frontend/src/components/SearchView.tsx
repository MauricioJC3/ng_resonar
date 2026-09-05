import { useEffect, useState } from "react";

import { getHistory, homeMusic, recommendations, search } from "../api";
import type { HistoryEntry, Track } from "../types";
import { usePlayer } from "../state/player";
import SearchBox from "./SearchBox";
import TrackRow from "./TrackRow";

// History entries carry videoId/title/artist/thumbnail; adapt to the Track shape
// TrackRow expects. kind:"video" rows enqueue as audio for this cycle (routing
// them into WatchView is deferred — see design Open Questions).
function historyToTrack(h: HistoryEntry): Track {
  return {
    id: h.videoId,
    title: h.title,
    artists: h.artist ? [h.artist] : [],
    album: null,
    duration: "",
    durationSeconds: 0,
    thumbnail: h.thumbnail ?? null,
  };
}

export default function SearchView() {
  const [results, setResults] = useState<Track[]>([]);
  const [home, setHome] = useState<Track[]>([]);
  const [forYou, setForYou] = useState<Track[]>([]);
  const [forYouLoading, setForYouLoading] = useState(true);
  const [recent, setRecent] = useState<Track[]>([]);
  const [status, setStatus] = useState<"empty" | "loading" | "idle" | "error">(
    "empty",
  );
  const [error, setError] = useState("");
  const { playList } = usePlayer();

  useEffect(() => {
    homeMusic().then(setHome);
  }, []);

  // Non-blocking, like the homeMusic() fetch above. Both api helpers already
  // resolve to [] on failure, so no error handling is needed here.
  useEffect(() => {
    recommendations()
      .then(setForYou)
      .finally(() => setForYouLoading(false));
  }, []);

  useEffect(() => {
    getHistory(20).then((entries) => setRecent(entries.map(historyToTrack)));
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
  // The "For you" / "Recently played" feeds only belong on the empty/home state;
  // an active search keeps its original results-only layout.
  const showFeeds = status === "empty";

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

      {showFeeds && forYouLoading && forYou.length === 0 && (
        <p className="hint" aria-busy="true">
          Preparando recomendaciones…
        </p>
      )}

      {showFeeds && forYou.length > 0 && (
        <section>
          <h2 className="view__subhead">Para ti</h2>
          <div className="tracklist">
            {forYou.map((track, i) => (
              <TrackRow
                key={"fy" + track.id + i}
                track={track}
                index={i}
                onPlay={() => playList(forYou, i)}
              />
            ))}
          </div>
        </section>
      )}

      {showFeeds && recent.length > 0 && (
        <section>
          <h2 className="view__subhead">Reproducido recientemente</h2>
          <div className="tracklist">
            {recent.map((track, i) => (
              <TrackRow
                key={"rp" + track.id + i}
                track={track}
                index={i}
                onPlay={() => playList(recent, i)}
              />
            ))}
          </div>
        </section>
      )}

      {showHome && <h2 className="view__subhead">Escucha algo ahora</h2>}

      <div className="tracklist">
        {(status === "empty" ? home : results).map((track, i) => (
          <TrackRow
            key={track.id + i}
            track={track}
            index={i}
            onPlay={() => playList(status === "empty" ? home : results, i)}
          />
        ))}
      </div>
    </div>
  );
}
