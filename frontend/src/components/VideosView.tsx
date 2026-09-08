import { useEffect, useState } from "react";

import { searchVideos, trendingVideos, videoInfo } from "../api";
import type { VideoItem } from "../types";
import { setVideoSearch, useSearchStore, videoHistoryGo } from "../state/search";
import { extractYouTubeId } from "../lib/youtube";
import Icon from "./Icon";
import SearchBox from "./SearchBox";
import VideoCard from "./VideoCard";

export default function VideosView({
  onWatch,
}: {
  onWatch: (v: VideoItem) => void;
}) {
  const { video } = useSearchStore();
  const [trending, setTrending] = useState<VideoItem[]>([]);
  // Seed from the cached search so returning from a video restores the list.
  const [status, setStatus] = useState<
    "empty" | "loading" | "idle" | "error"
  >(video.query ? "idle" : "empty");
  const [error, setError] = useState("");
  const [navDir, setNavDir] = useState<"" | "back" | "fwd">("");

  useEffect(() => {
    trendingVideos().then(setTrending);
  }, []);

  async function run(term: string, push = true) {
    if (push) setNavDir("");
    const id = extractYouTubeId(term);
    if (id) {
      setStatus("loading");
      setError("");
      try {
        onWatch(await videoInfo(id));
        setStatus(video.query ? "idle" : "empty");
      } catch {
        onWatch({
          id,
          title: id,
          thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        });
      }
      return;
    }
    setStatus("loading");
    setError("");
    try {
      const results = await searchVideos(term);
      setVideoSearch({ query: term, results }, push);
      setStatus("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
      setStatus("error");
    }
  }

  function stepHistory(delta: number) {
    const term = videoHistoryGo(delta);
    if (!term) return;
    setNavDir(delta < 0 ? "back" : "fwd");
    run(term, false);
  }

  const results = video.results;
  const showTrending = status === "empty" && trending.length > 0;
  const canBack = video.cursor > 0;
  const canForward = video.cursor < video.history.length - 1;

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
          placeholder="Buscar en YouTube o pegar un enlace…"
          onSubmit={run}
          query={video.query}
        />
      </div>

      {status === "loading" && <p className="hint">Cargando…</p>}
      {status === "error" && (
        <p className="hint hint--error">No se pudo buscar: {error}</p>
      )}

      {status === "empty" && trending.length === 0 && (
        <div className="empty">
          <p>Busca cualquier video de YouTube, o pega un enlace.</p>
          <p className="empty__sub">Se reproduce aquí mismo, sin anuncios.</p>
        </div>
      )}

      {status === "idle" && results.length === 0 && (
        <p className="hint">Sin resultados.</p>
      )}

      {showTrending && <h2 className="view__subhead">En tendencia</h2>}

      <div
        className={
          "searchresults" + (navDir ? ` searchresults--${navDir}` : "")
        }
        key={`${video.cursor}|${video.query}`}
      >
        <div className="videogrid">
          {(status === "empty" ? trending : results).map((v) => (
            <VideoCard key={v.id} video={v} onClick={() => onWatch(v)} />
          ))}
        </div>
      </div>
    </div>
  );
}
