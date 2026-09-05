import { useEffect, useRef, useState } from "react";
import Plyr from "plyr";
import "plyr/dist/plyr.css";

import {
  recordPlay,
  savedVideoDownloadUrl,
  savedVideoFileUrl,
  searchVideos,
  videoStreamUrl,
} from "../api";
import type { VideoItem } from "../types";
import {
  claimPlayback,
  onPlaybackClaim,
  setVideoActive,
} from "../state/mediabus";
import {
  removeSavedVideo,
  saveVideo,
  savedEntry,
  useSavedVideos,
} from "../state/savedVideos";
import Icon from "./Icon";
import VideoCard from "./VideoCard";

const QUALITIES = [720, 1080, 1440];
const SB_KEY = "resonar:sb";

interface Segment {
  start: number;
  end: number;
  category: string;
}

const SB_LABEL: Record<string, string> = {
  sponsor: "patrocinio",
  selfpromo: "autopromoción",
  interaction: "recordatorio",
  intro: "intro",
  outro: "cierre",
  preview: "resumen",
  music_offtopic: "sección sin música",
};

export default function WatchView({
  video,
  onClose,
  onWatch,
}: {
  video: VideoItem;
  onClose: () => void;
  onWatch: (v: VideoItem) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const plyrRef = useRef<Plyr | null>(null);
  const lastIdRef = useRef(video.id);

  const saved = useSavedVideos();
  const entry = savedEntry(video.id, saved);
  const isHD = entry?.status === "ready";
  const srcUrl = isHD ? savedVideoFileUrl(video.id) : videoStreamUrl(video.id);

  const [quality, setQuality] = useState(1080);
  const [related, setRelated] = useState<VideoItem[]>([]);
  const [sbOn, setSbOn] = useState(() => {
    try {
      return localStorage.getItem(SB_KEY) !== "0";
    } catch {
      return true;
    }
  });
  const [skipFlash, setSkipFlash] = useState<string | null>(null);

  const segmentsRef = useRef<Segment[]>([]);
  const sbOnRef = useRef(sbOn);
  sbOnRef.current = sbOn;

  useEffect(() => {
    if (!videoRef.current) return;
    setVideoActive(true);
    const player = new Plyr(videoRef.current, {
      controls: [
        "play-large",
        "play",
        "progress",
        "current-time",
        "duration",
        "mute",
        "volume",
        "settings",
        "pip",
        "fullscreen",
      ],
      settings: ["speed"],
      seekTime: 10,
      keyboard: { focused: true, global: true },
    });
    plyrRef.current = player;
    player.on("play", () => {
      claimPlayback("video");
      recordPlay(video, "video", "watch");
    });
    const off = onPlaybackClaim((kind) => {
      if (kind !== "video") videoRef.current?.pause();
    });
    return () => {
      off();
      setVideoActive(false);
      player.destroy();
    };
  }, []);

  // Source (quick preview vs saved HD), keeping the current position on swap.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const sameVideo = lastIdRef.current === video.id;
    const resumeAt = sameVideo ? el.currentTime : 0;
    lastIdRef.current = video.id;

    el.src = srcUrl;
    const onMeta = () => {
      if (resumeAt > 1 && Number.isFinite(resumeAt)) {
        try {
          el.currentTime = resumeAt;
        } catch {
          /* ignore */
        }
      }
    };
    el.addEventListener("loadedmetadata", onMeta, { once: true });
    el.play().catch(() => {});
    return () => el.removeEventListener("loadedmetadata", onMeta);
  }, [srcUrl, video.id]);

  // SponsorBlock segments for this video.
  useEffect(() => {
    segmentsRef.current = [];
    setSkipFlash(null);
    let alive = true;
    fetch(`/api/sponsorblock/${video.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (alive) segmentsRef.current = d.segments ?? [];
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [video.id]);

  // Auto-skip while playing.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    let flashTimer: number | undefined;
    const onTime = () => {
      if (!sbOnRef.current) return;
      const t = el.currentTime;
      for (const seg of segmentsRef.current) {
        if (t >= seg.start && t < seg.end - 0.4) {
          el.currentTime = seg.end;
          setSkipFlash(SB_LABEL[seg.category] ?? "segmento");
          window.clearTimeout(flashTimer);
          flashTimer = window.setTimeout(() => setSkipFlash(null), 1600);
          break;
        }
      }
    };
    el.addEventListener("timeupdate", onTime);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      window.clearTimeout(flashTimer);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    searchVideos(video.title)
      .then((r) => {
        if (alive) setRelated(r.filter((v) => v.id !== video.id));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [video.id, video.title]);

  function toggleSb() {
    setSbOn((v) => {
      const nv = !v;
      try {
        localStorage.setItem(SB_KEY, nv ? "1" : "0");
      } catch {
        /* ignore */
      }
      return nv;
    });
  }

  return (
    <div className="view watch">
      <button className="watch__back" onClick={onClose}>
        <Icon name="back" size={16} /> Volver a videos
      </button>

      <div className="watch__stage">
        {isHD && <span className="watch__hd">HD</span>}
        {skipFlash && (
          <span className="watch__skip">⏭ Saltado: {skipFlash}</span>
        )}
        <video ref={videoRef} playsInline />
      </div>

      <h1 className="watch__title">{video.title}</h1>
      <p className="watch__meta">{video.uploader}</p>

      <div className="savebox">
        {!entry && (
          <>
            <select
              className="savebox__quality"
              value={quality}
              onChange={(e) => setQuality(Number(e.target.value))}
            >
              {QUALITIES.map((q) => (
                <option key={q} value={q}>
                  {q}p
                </option>
              ))}
            </select>
            <button
              className="btn btn--accent"
              onClick={() => saveVideo(video.id, quality)}
            >
              <Icon name="download" size={15} /> Guardar en HD
            </button>
          </>
        )}

        {entry?.status === "downloading" && (
          <button className="btn" disabled>
            <span className="spinner" /> Guardando… {entry.progress ?? ""}
          </button>
        )}

        {entry?.status === "ready" && (
          <>
            <span className="badge badge--hd">
              Guardado{entry.height ? ` · ${entry.height}p` : ""}
            </span>
            <a className="btn" href={savedVideoDownloadUrl(video.id)} download>
              <Icon name="download" size={15} /> Descargar archivo
            </a>
            <button
              className="btn btn--ghost"
              onClick={() => removeSavedVideo(video.id)}
            >
              Quitar
            </button>
          </>
        )}

        {entry?.status === "error" && (
          <>
            <span className="hint hint--error">
              No se pudo guardar{entry.error ? `: ${entry.error}` : ""}
            </span>
            <button
              className="btn"
              onClick={() => saveVideo(video.id, quality, true)}
            >
              Reintentar
            </button>
          </>
        )}

        <button
          className={"chip" + (sbOn ? " chip--on" : "")}
          onClick={toggleSb}
          title="Saltar patrocinios e intros automáticamente (SponsorBlock)"
        >
          SponsorBlock {sbOn ? "activado" : "apagado"}
        </button>
      </div>

      <p className="watch__note">
        La vista rápida es 360–720p. «Guardar en HD» une video + audio en el
        servidor y lo deja re-reproducible en alta calidad.
      </p>

      {related.length > 0 && (
        <>
          <h2 className="watch__subhead">A continuación</h2>
          <div className="videogrid videogrid--compact">
            {related.slice(0, 12).map((v) => (
              <VideoCard key={v.id} video={v} onClick={() => onWatch(v)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
