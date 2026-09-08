import { useCallback, useEffect, useState } from "react";

import { clearHistory, getHistory } from "../api";
import type { HistoryEntry, Track, VideoItem } from "../types";
import { usePlayer } from "../state/player";
import Icon from "./Icon";
import TrackRow from "./TrackRow";

type Tab = "song" | "video";

const toTrack = (e: HistoryEntry): Track => ({
  id: e.videoId,
  title: e.title,
  artists: e.artist ? [e.artist] : [],
  thumbnail: e.thumbnail ?? null,
});

const toVideo = (e: HistoryEntry): VideoItem => ({
  id: e.videoId,
  title: e.title,
  uploader: e.artist ?? null,
  thumbnail:
    e.thumbnail ?? `https://i.ytimg.com/vi/${e.videoId}/hqdefault.jpg`,
});

function ago(epochSeconds: number): string {
  const s = Math.max(0, Math.floor(Date.now() / 1000 - epochSeconds));
  if (s < 60) return "hace un momento";
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `hace ${d} d`;
  return new Date(epochSeconds * 1000).toLocaleDateString();
}

export default function HistoryView({
  onWatch,
}: {
  onWatch: (v: VideoItem) => void;
}) {
  const [tab, setTab] = useState<Tab>("song");
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { playList } = usePlayer();

  const load = useCallback((kind: Tab) => {
    setLoading(true);
    getHistory(200, kind)
      .then(setEntries)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load(tab);
  }, [tab, load]);

  async function onClear() {
    const label = tab === "song" ? "de canciones" : "de videos";
    if (!window.confirm(`¿Borrar todo el historial ${label}?`)) return;
    await clearHistory(tab);
    setEntries([]);
  }

  const songs = entries.map(toTrack);

  return (
    <div className="view">
      <h1 className="view__title">Historial</h1>

      <div className="segmented">
        <button
          className={tab === "song" ? "is-on" : ""}
          onClick={() => setTab("song")}
        >
          Canciones
        </button>
        <button
          className={tab === "video" ? "is-on" : ""}
          onClick={() => setTab("video")}
        >
          Videos
        </button>
      </div>

      {entries.length > 0 && (
        <div className="view__toolbar">
          <button className="btn btn--ghost" onClick={onClear}>
            <Icon name="trash" size={14} /> Borrar historial
          </button>
        </div>
      )}

      {loading && <p className="hint">Cargando…</p>}

      {!loading && entries.length === 0 && (
        <div className="empty">
          <p>
            {tab === "song"
              ? "Todavía no has escuchado canciones."
              : "Todavía no has visto videos."}
          </p>
          <p className="empty__sub">
            Lo que reproduzcas aparecerá aquí, más reciente primero.
          </p>
        </div>
      )}

      {!loading && tab === "song" && entries.length > 0 && (
        <div className="tracklist">
          {songs.map((track, i) => (
            <TrackRow
              key={`${track.id}-${i}`}
              track={track}
              index={i}
              onPlay={() => playList(songs, i)}
            />
          ))}
        </div>
      )}

      {!loading && tab === "video" && entries.length > 0 && (
        <div className="histrows">
          {entries.map((e, i) => {
            const v = toVideo(e);
            return (
              <button
                key={`${e.videoId}-${i}`}
                className="histrow"
                onClick={() => onWatch(v)}
              >
                <img className="histrow__art" src={v.thumbnail} alt="" loading="lazy" />
                <span className="histrow__info">
                  <span className="histrow__title">{e.title}</span>
                  <span className="histrow__sub">
                    {[e.artist, ago(e.playedAt)].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
