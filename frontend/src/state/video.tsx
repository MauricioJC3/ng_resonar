import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Plyr from "plyr";
import "plyr/dist/plyr.css";

import { recordPlay, savedVideoFileUrl, videoStreamUrl } from "../api";
import type { VideoItem } from "../types";
import { claimPlayback, onPlaybackClaim, setVideoActive } from "./mediabus";
import { savedEntry, useSavedVideos } from "./savedVideos";

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

type LoadState = "loading" | "ready" | "error";

interface VideoApi {
  current: VideoItem | null;
  loadState: LoadState;
  sbOn: boolean;
  skipFlash: string | null;
  isHD: boolean;
  paused: boolean;
  playVideo: (v: VideoItem) => void;
  closeVideo: () => void;
  reload: () => void;
  toggleSb: () => void;
  togglePlay: () => void;
  seekBy: (delta: number) => void;
  /**
   * Move the persistent player node into `el` (or back to the hidden holder when
   * null). `owner` is a stable id for the calling surface: a null release only
   * takes effect if that surface is still the current holder, so a hand-off
   * between two surfaces in one commit is order-independent.
   */
  attachTo: (el: HTMLElement | null, owner: string) => void;
}

const VideoContext = createContext<VideoApi | null>(null);

// Reachable from the plain-module reset aggregator (state/reset.ts).
let closeFn: (() => void) | null = null;
export function resetVideo() {
  closeFn?.();
}

export function VideoProvider({ children }: { children: ReactNode }) {
  const holderRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const plyrRef = useRef<Plyr | null>(null);
  const targetRef = useRef<HTMLElement | null>(null);
  const ownerRef = useRef<string | null>(null);
  const lastIdRef = useRef<string | null>(null);

  const [current, setCurrent] = useState<VideoItem | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [sbOn, setSbOn] = useState(() => {
    try {
      return localStorage.getItem(SB_KEY) !== "0";
    } catch {
      return true;
    }
  });
  const [skipFlash, setSkipFlash] = useState<string | null>(null);
  const [paused, setPaused] = useState(true);

  const currentRef = useRef(current);
  currentRef.current = current;
  const segmentsRef = useRef<Segment[]>([]);
  const sbOnRef = useRef(sbOn);
  sbOnRef.current = sbOn;

  const saved = useSavedVideos();
  const entry = current ? savedEntry(current.id, saved) : undefined;
  const isHD = entry?.status === "ready";
  const srcUrl = current
    ? isHD
      ? savedVideoFileUrl(current.id)
      : videoStreamUrl(current.id)
    : "";

  // Park the player node in `targetRef` (or the hidden holder). Idempotent, and
  // safe to call before the Plyr instance exists — it re-runs after setup.
  const place = useCallback(() => {
    const box = boxRef.current;
    const dest = targetRef.current ?? holderRef.current;
    if (box && dest && box.parentElement !== dest) dest.appendChild(box);
  }, []);

  // A mounting stage (WatchView / MiniVideo) claims the node and wins. A release
  // (el === null) only lands if the releasing surface is still the holder — so a
  // hand-off between the two surfaces in one commit is order-independent.
  const attachTo = useCallback(
    (el: HTMLElement | null, owner: string) => {
      if (el) {
        ownerRef.current = owner;
        targetRef.current = el;
        place();
        return;
      }
      if (ownerRef.current !== owner) return;
      ownerRef.current = null;
      targetRef.current = null;
      place();
    },
    [place],
  );

  // ---- One-time player construction (imperative DOM so React never reconciles
  // the moving subtree). ----
  useEffect(() => {
    const holder = holderRef.current;
    if (!holder) return;

    const box = document.createElement("div");
    box.className = "video-box";
    const video = document.createElement("video");
    video.setAttribute("playsinline", "");
    video.playsInline = true;
    box.appendChild(video);
    holder.appendChild(box);
    boxRef.current = box;
    videoElRef.current = video;

    const player = new Plyr(video, {
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
      setPaused(false);
      claimPlayback("video");
      const c = currentRef.current;
      if (c) recordPlay(c, "video", "watch");
    });
    player.on("pause", () => setPaused(true));
    player.on("ended", () => setPaused(true));

    const offClaim = onPlaybackClaim((kind) => {
      if (kind !== "video") video.pause();
    });

    place();

    return () => {
      offClaim();
      setVideoActive(false);
      player.destroy();
      box.remove();
      boxRef.current = null;
      videoElRef.current = null;
      plyrRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Music/video shortcut arbitration: a loaded video (mini or full) owns
  // the keyboard. ----
  useEffect(() => {
    setVideoActive(current != null);
  }, [current]);

  // ---- Load / swap the source, keeping position on a same-video swap. ----
  useEffect(() => {
    const el = videoElRef.current;
    if (!el || !current || !srcUrl) return;

    const sameVideo = lastIdRef.current === current.id;
    const resumeAt = sameVideo ? el.currentTime : 0;
    lastIdRef.current = current.id;

    setLoadState("loading");
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
    const onReady = () => setLoadState("ready");
    const onError = () => setLoadState("error");
    // yt-dlp extraction can be slow but not forever — after this a still
    // "loading" stage is a stuck stream, not a slow one.
    const timeout = window.setTimeout(() => {
      setLoadState((s) => (s === "loading" ? "error" : s));
    }, 25000);

    el.addEventListener("loadedmetadata", onMeta, { once: true });
    el.addEventListener("playing", onReady);
    el.addEventListener("canplay", onReady);
    el.addEventListener("error", onError);
    el.play().catch(() => {});

    return () => {
      window.clearTimeout(timeout);
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("playing", onReady);
      el.removeEventListener("canplay", onReady);
      el.removeEventListener("error", onError);
    };
  }, [srcUrl, current, reloadKey]);

  // ---- SponsorBlock segments for the current video. ----
  useEffect(() => {
    segmentsRef.current = [];
    setSkipFlash(null);
    if (!current) return;
    let alive = true;
    fetch(`/api/sponsorblock/${current.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (alive) segmentsRef.current = d.segments ?? [];
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [current]);

  // ---- Auto-skip sponsored / intro segments while playing. ----
  useEffect(() => {
    const el = videoElRef.current;
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

  const playVideo = useCallback((v: VideoItem) => {
    // Re-opening the video that's already loaded (e.g. expanding the mini-player)
    // must not flip the stage back to "Cargando…" — only a real source change
    // does, and the load effect below handles that.
    if (currentRef.current?.id === v.id) return;
    setCurrent(v);
    setLoadState("loading");
  }, []);

  const closeVideo = useCallback(() => {
    const el = videoElRef.current;
    if (el) {
      el.pause();
      el.removeAttribute("src");
      try {
        el.load();
      } catch {
        /* ignore */
      }
    }
    lastIdRef.current = null;
    setCurrent(null);
    setLoadState("loading");
  }, []);

  const reload = useCallback(() => {
    setLoadState("loading");
    setReloadKey((k) => k + 1);
  }, []);

  const togglePlay = useCallback(() => {
    plyrRef.current?.togglePlay();
  }, []);

  const seekBy = useCallback((delta: number) => {
    const el = videoElRef.current;
    if (!el) return;
    const max = Number.isFinite(el.duration) ? el.duration : Infinity;
    el.currentTime = Math.max(0, Math.min(max, el.currentTime + delta));
  }, []);

  const toggleSb = useCallback(() => {
    setSbOn((v) => {
      const nv = !v;
      try {
        localStorage.setItem(SB_KEY, nv ? "1" : "0");
      } catch {
        /* ignore */
      }
      return nv;
    });
  }, []);

  useEffect(() => {
    closeFn = closeVideo;
    return () => {
      closeFn = null;
    };
  }, [closeVideo]);

  const api: VideoApi = {
    current,
    loadState,
    sbOn,
    skipFlash,
    isHD: !!isHD,
    paused,
    playVideo,
    closeVideo,
    reload,
    toggleSb,
    togglePlay,
    seekBy,
    attachTo,
  };

  return (
    <VideoContext.Provider value={api}>
      {children}
      <div ref={holderRef} className="video-holder" hidden aria-hidden="true" />
    </VideoContext.Provider>
  );
}

export function useVideo(): VideoApi {
  const ctx = useContext(VideoContext);
  if (!ctx) throw new Error("useVideo must be used inside <VideoProvider>");
  return ctx;
}
