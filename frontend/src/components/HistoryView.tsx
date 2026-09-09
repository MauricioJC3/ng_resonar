import { useCallback, useEffect, useState } from "react";

import { clearHistory, getHistory } from "../api";
import type { HistoryEntry, Track, VideoItem } from "../types";
import { usePlayer } from "../state/player";
import { useListKeyboard } from "../lib/useListKeyboard";
import { paginate } from "../lib/paginate";
import Icon from "./Icon";
import TrackRow from "./TrackRow";

type Tab = "song" | "video";

// History is capped server-side at 800 rows/user; fetch the lot and page through
// it here so the list never turns into an endless scroll.
const FETCH_CAP = 800;
const PAGE_SIZE = 50;

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

function scrollTop() {
  const main = document.querySelector<HTMLElement>(".main");
  main?.scrollTo({
    top: 0,
    behavior:
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
  });
}

function Pager({
  page,
  pageCount,
  total,
  onGo,
}: {
  page: number;
  pageCount: number;
  total: number;
  onGo: (p: number) => void;
}) {
  return (
    <div className="pager">
      <button
        className="pager__btn"
        disabled={page === 0}
        onClick={() => onGo(page - 1)}
      >
        <Icon name="back" size={15} /> Anterior
      </button>
      <span className="pager__label">
        Página {page + 1} de {pageCount} · {total} en total
      </span>
      <button
        className="pager__btn pager__btn--next"
        disabled={page >= pageCount - 1}
        onClick={() => onGo(page + 1)}
      >
        Siguiente <Icon name="back" size={15} />
      </button>
    </div>
  );
}

export default function HistoryView({
  onWatch,
}: {
  onWatch: (v: VideoItem) => void;
}) {
  const [tab, setTab] = useState<Tab>("song");
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const { playList } = usePlayer();

  const load = useCallback((kind: Tab) => {
    setLoading(true);
    getHistory(FETCH_CAP, kind)
      .then(setEntries)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setPage(0);
    load(tab);
  }, [tab, load]);

  const {
    pageCount,
    current: safePage,
    start,
    slice: pageEntries,
  } = paginate(entries, page, PAGE_SIZE);

  function goPage(p: number) {
    setPage(Math.max(0, Math.min(p, pageCount - 1)));
    scrollTop();
  }

  async function onClear() {
    const label = tab === "song" ? "de canciones" : "de videos";
    if (!window.confirm(`¿Borrar todo el historial ${label}?`)) return;
    await clearHistory(tab);
    setEntries([]);
    setPage(0);
  }

  const pageSongs = pageEntries.map(toTrack);
  const { activeIndex, containerRef } = useListKeyboard(
    tab === "song" ? pageSongs.length : 0,
    (i) => playList(pageSongs, i),
  );

  const showPager = entries.length > PAGE_SIZE;

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

      {!loading && showPager && (
        <Pager
          page={safePage}
          pageCount={pageCount}
          total={entries.length}
          onGo={goPage}
        />
      )}

      {!loading && tab === "song" && pageEntries.length > 0 && (
        <div
          className="tracklist"
          ref={(el) => {
            containerRef.current = el;
          }}
        >
          {pageSongs.map((track, i) => (
            <TrackRow
              key={`${track.id}-${start + i}`}
              track={track}
              index={start + i}
              selected={i === activeIndex}
              onPlay={() => playList(pageSongs, i)}
            />
          ))}
        </div>
      )}

      {!loading && tab === "video" && pageEntries.length > 0 && (
        <div className="histrows">
          {pageEntries.map((e, i) => {
            const v = toVideo(e);
            return (
              <button
                key={`${e.videoId}-${start + i}`}
                className="histrow"
                onClick={() => onWatch(v)}
              >
                <img
                  className="histrow__art"
                  src={v.thumbnail}
                  alt=""
                  loading="lazy"
                />
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

      {!loading && showPager && (
        <Pager
          page={safePage}
          pageCount={pageCount}
          total={entries.length}
          onGo={goPage}
        />
      )}
    </div>
  );
}
