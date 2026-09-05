import { useEffect, useState } from "react";

import { getHistory, homeMusic, recommendations } from "../api";
import type { HistoryEntry, Track } from "../types";
import { usePlayer } from "../state/player";
import TrackRow from "./TrackRow";

// History entries carry videoId/title/artist/thumbnail; adapt to the Track shape
// the player and TrackRow expect. kind:"video" entries enqueue as audio for now.
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

export default function HomeView() {
  const [forYou, setForYou] = useState<Track[]>([]);
  const [loadingForYou, setLoadingForYou] = useState(true);
  const [recent, setRecent] = useState<Track[]>([]);
  const [feed, setFeed] = useState<Track[]>([]);
  const { playList } = usePlayer();

  // Each feed loads independently and non-blocking; the api helpers already
  // resolve to [] on failure, so a slow or dead source just leaves its section
  // empty (and therefore hidden) instead of breaking the page.
  useEffect(() => {
    recommendations()
      .then(setForYou)
      .finally(() => setLoadingForYou(false));
  }, []);

  useEffect(() => {
    getHistory(20).then((entries) => setRecent(entries.map(historyToTrack)));
  }, []);

  useEffect(() => {
    homeMusic().then(setFeed);
  }, []);

  const nothing =
    !loadingForYou &&
    forYou.length === 0 &&
    recent.length === 0 &&
    feed.length === 0;

  return (
    <div className="view">
      <h1 className="view__title">Inicio</h1>

      {nothing && (
        <div className="empty">
          <p>Todavía no hay nada por acá.</p>
          <p className="empty__sub">
            Reproducí algo y tus recomendaciones y lo escuchado recientemente
            van a aparecer en esta pantalla.
          </p>
        </div>
      )}

      {loadingForYou && forYou.length === 0 && !nothing && (
        <p className="hint" aria-busy="true">
          Preparando recomendaciones…
        </p>
      )}

      {forYou.length > 0 && (
        <section className="home__section">
          <h2 className="view__subhead">Para ti</h2>
          <div className="hcards">
            {forYou.slice(0, 12).map((track, i) => (
              <button
                key={"fy" + track.id + i}
                className="hcard"
                type="button"
                onClick={() => playList(forYou, i)}
                title={
                  track.artists.length
                    ? `${track.title} — ${track.artists.join(", ")}`
                    : track.title
                }
              >
                <span className="hcard__art">
                  {track.thumbnail && (
                    <img src={track.thumbnail} alt="" loading="lazy" />
                  )}
                </span>
                <span className="hcard__title">{track.title}</span>
                <span className="hcard__meta">{track.artists.join(", ")}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {recent.length > 0 && (
        <section className="home__section">
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

      {feed.length > 0 && (
        <section className="home__section">
          <h2 className="view__subhead">Escucha algo ahora</h2>
          <div className="tracklist">
            {feed.map((track, i) => (
              <TrackRow
                key={track.id + i}
                track={track}
                index={i}
                onPlay={() => playList(feed, i)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
