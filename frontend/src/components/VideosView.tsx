import { useEffect, useState } from "react";

import { searchVideos, trendingVideos, videoInfo } from "../api";
import type { VideoItem } from "../types";
import { setVideoSearch, useSearchStore } from "../state/search";
import { extractYouTubeId } from "../lib/youtube";
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

  useEffect(() => {
    trendingVideos().then(setTrending);
  }, []);

  async function run(term: string) {
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
      setVideoSearch({ query: term, results });
      setStatus("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido");
      setStatus("error");
    }
  }

  const results = video.results;
  const showTrending = status === "empty" && trending.length > 0;

  return (
    <div className="view">
      <SearchBox
        autoFocus
        placeholder="Buscar en YouTube o pegar un enlace…"
        onSubmit={run}
      />

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

      <div className="videogrid">
        {(status === "empty" ? trending : results).map((v) => (
          <VideoCard key={v.id} video={v} onClick={() => onWatch(v)} />
        ))}
      </div>
    </div>
  );
}
