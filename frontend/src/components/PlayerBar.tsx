import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import Plyr from "plyr";
import "plyr/dist/plyr.css";

import {
  downloadUrl,
  recordPlay,
  related,
  scrobbleNowPlaying,
  scrobbleSubmit,
  streamUrl,
} from "../api";
import { isSaved, toggleLibrary, useLibrary } from "../state/library";
import { usePlayer } from "../state/player";
import { claimPlayback, isVideoActive, onPlaybackClaim } from "../state/mediabus";
import { registerSeeker, setNowPlaying } from "../state/nowPlaying";
import { scrobblingOn } from "../state/settings";
import AddToPlaylistButton from "./AddToPlaylistButton";
import ArtistLinks from "./ArtistLinks";
import Icon from "./Icon";
import QueuePanel from "./QueuePanel";
import LyricsPanel from "./LyricsPanel";

const LEVEL_KEY = "resonar:level";

function reducedMotion(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export default function PlayerBar() {
  const { current, next, prev, hasNext, radio, toggleRadio, appendMany, queue } =
    usePlayer();
  const library = useLibrary();

  const audioRef = useRef<HTMLAudioElement>(null);
  const plyrRef = useRef<Plyr | null>(null);
  const [queueOpen, setQueueOpen] = useState(false);
  const [lyricsOpen, setLyricsOpen] = useState(false);

  // Full-screen now-playing = pure CSS expansion of this same footer. No new
  // component, no second <audio>/Plyr — only this boolean flips.
  const [expanded, setExpanded] = useState(false);

  function flipExpanded(v: boolean) {
    if (
      typeof document.startViewTransition === "function" &&
      !reducedMotion()
    ) {
      document.startViewTransition(() => flushSync(() => setExpanded(v)));
    } else {
      setExpanded(v);
    }
  }

  function openExpanded() {
    if (!current || expanded) return;
    // Push a history entry so the Back gesture collapses instead of leaving.
    history.pushState({ ...(history.state || {}), np: true }, "");
    flipExpanded(true);
  }

  function closeExpanded() {
    if ((history.state as NavHistoryState | null)?.np) history.back();
    else flipExpanded(false);
  }

  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      flipExpanded(Boolean((e.state as NavHistoryState | null)?.np));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const nextRef = useRef(next);
  const prevRef = useRef(prev);
  nextRef.current = next;
  prevRef.current = prev;

  const currentRef = useRef(current);
  currentRef.current = current;
  const scrobbledRef = useRef(false);

  // ---- Web Audio volume leveling (engaged only when turned on) ----
  const [leveled, setLeveled] = useState(() => {
    try {
      return localStorage.getItem(LEVEL_KEY) === "1";
    } catch {
      return false;
    }
  });
  const audioCtxRef = useRef<AudioContext | null>(null);
  const graphRef = useRef<{
    src: MediaElementAudioSourceNode;
    comp: DynamicsCompressorNode;
    gain: GainNode;
  } | null>(null);

  function routeGraph(on: boolean) {
    const g = graphRef.current;
    const ctx = audioCtxRef.current;
    if (!g || !ctx) return;
    for (const n of [g.src, g.comp, g.gain]) {
      try {
        n.disconnect();
      } catch {
        /* ignore */
      }
    }
    if (on) {
      g.src.connect(g.comp);
      g.comp.connect(g.gain);
      g.gain.connect(ctx.destination);
    } else {
      g.src.connect(ctx.destination);
    }
  }

  function buildGraph() {
    if (graphRef.current || !audioRef.current) return;
    const Ctx: typeof AudioContext =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new Ctx();
    audioCtxRef.current = ctx;
    const src = ctx.createMediaElementSource(audioRef.current);
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -26;
    comp.knee.value = 28;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.25;
    const gain = ctx.createGain();
    gain.gain.value = 1.35;
    graphRef.current = { src, comp, gain };
  }

  function toggleLevel() {
    setLeveled((prevOn) => {
      const on = !prevOn;
      try {
        localStorage.setItem(LEVEL_KEY, on ? "1" : "0");
      } catch {
        /* ignore */
      }
      if (on) buildGraph();
      audioCtxRef.current?.resume?.();
      routeGraph(on);
      return on;
    });
  }

  // ---- Plyr lifecycle ----
  useEffect(() => {
    if (!audioRef.current) return;
    const player = new Plyr(audioRef.current, {
      controls: [
        "play",
        "progress",
        "current-time",
        "duration",
        "mute",
        "volume",
      ],
      seekTime: 5,
      storage: { enabled: true, key: "resonar" },
    });
    plyrRef.current = player;
    registerSeeker((t) => {
      try {
        player.currentTime = t;
      } catch {
        /* ignore */
      }
    });

    let lastPush = 0;
    const onTime = () => {
      const now = performance.now();
      if (now - lastPush < 200) return;
      lastPush = now;
      const t = player.currentTime;
      const d = player.duration || 0;
      setNowPlaying({ time: t, duration: d });

      if ("mediaSession" in navigator && d > 0 && Number.isFinite(d)) {
        try {
          navigator.mediaSession.setPositionState?.({
            duration: d,
            playbackRate: 1,
            position: Math.min(t, d),
          });
        } catch {
          /* position can briefly exceed duration */
        }
      }

      const c = currentRef.current;
      if (c && !scrobbledRef.current && d > 30 && (t >= 240 || t >= d / 2)) {
        scrobbledRef.current = true;
        if (scrobblingOn()) scrobbleSubmit(c);
      }
    };
    player.on("timeupdate", onTime);
    player.on("play", () => {
      claimPlayback("music");
      audioCtxRef.current?.resume?.();
      setNowPlaying({ paused: false });
      if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "playing";
    });
    player.on("pause", () => {
      setNowPlaying({ paused: true });
      if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "paused";
    });

    const off = onPlaybackClaim((kind) => {
      if (kind !== "music") audioRef.current?.pause();
    });
    return () => {
      off();
      player.destroy();
      audioCtxRef.current?.close?.();
    };
  }, []);

  // ---- "Radio": fill the queue with similar songs as soon as it's turned on
  // (don't wait for the current track to end), when there's nothing queued after
  // the current one. ----
  const radioWasOn = useRef(radio);
  useEffect(() => {
    const turnedOn = radio && !radioWasOn.current;
    radioWasOn.current = radio;
    if (!turnedOn || !current || hasNext) return;
    let alive = true;
    related(current.id)
      .then((more) => {
        if (!alive) return;
        const have = new Set(queue.map((t) => t.id));
        const fresh = more.filter((t) => !have.has(t.id)).slice(0, 20);
        if (fresh.length) appendMany(fresh);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [radio, current, hasNext, queue, appendMany]);

  // ---- "Radio": extend the queue with similar songs at the end ----
  useEffect(() => {
    const player = plyrRef.current;
    if (!player) return;
    const onEnded = async () => {
      if (radio && !hasNext && current) {
        try {
          const more = await related(current.id);
          const have = new Set(queue.map((t) => t.id));
          const fresh = more.filter((t) => !have.has(t.id)).slice(0, 20);
          if (fresh.length) appendMany(fresh);
        } catch {
          /* ignore */
        }
      }
      nextRef.current();
    };
    player.on("ended", onEnded);
    return () => player.off("ended", onEnded);
  }, [radio, hasNext, current, queue, appendMany]);

  // ---- Keyboard shortcuts (music only) ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT" ||
          el.isContentEditable)
      )
        return;
      if (isVideoActive()) return;
      const p = plyrRef.current;
      if (!p) return;
      switch (e.key) {
        case " ":
          e.preventDefault();
          p.togglePlay();
          break;
        case "ArrowRight":
          p.currentTime = Math.min(p.duration || Infinity, p.currentTime + 5);
          break;
        case "ArrowLeft":
          p.currentTime = Math.max(0, p.currentTime - 5);
          break;
        case "n":
        case "N":
          nextRef.current();
          break;
        case "p":
        case "P":
          prevRef.current();
          break;
        case "m":
        case "M":
          p.muted = !p.muted;
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ---- Load current track ----
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !current) return;

    audio.src = streamUrl(current.id);
    audio.play().catch(() => {
      /* autoplay may be blocked until the first gesture */
    });

    scrobbledRef.current = false;
    recordPlay(current, "song", "player");
    if (scrobblingOn()) scrobbleNowPlaying(current);

    if ("mediaSession" in navigator) {
      const ms = navigator.mediaSession;
      ms.metadata = new MediaMetadata({
        title: current.title,
        artist: current.artists.join(", "),
        album: current.album ?? "",
        artwork: current.thumbnail
          ? [{ src: current.thumbnail, sizes: "544x544", type: "image/jpeg" }]
          : [],
      });
      const seekBy = (delta: number) => {
        const a = audioRef.current;
        if (a) a.currentTime = Math.max(0, a.currentTime + delta);
      };
      ms.setActionHandler("play", () => audioRef.current?.play());
      ms.setActionHandler("pause", () => audioRef.current?.pause());
      ms.setActionHandler("stop", () => audioRef.current?.pause());
      ms.setActionHandler("previoustrack", () => prevRef.current());
      ms.setActionHandler("nexttrack", () => nextRef.current());
      ms.setActionHandler("seekbackward", (d) => seekBy(-(d.seekOffset || 10)));
      ms.setActionHandler("seekforward", (d) => seekBy(d.seekOffset || 10));
      ms.setActionHandler("seekto", (d) => {
        if (d.seekTime != null && audioRef.current) {
          audioRef.current.currentTime = d.seekTime;
        }
      });
    }
  }, [current]);

  return (
    <>
      <QueuePanel open={queueOpen} onClose={() => setQueueOpen(false)} />
      <LyricsPanel open={lyricsOpen} onClose={() => setLyricsOpen(false)} />

      <footer
        className={"player" + (expanded ? " player--expanded" : "")}
        data-expanded={expanded || undefined}
        role={expanded ? "dialog" : undefined}
        aria-label={expanded ? "Reproduciendo ahora" : undefined}
      >
        {expanded && (
          <button
            className="player__collapse"
            onClick={closeExpanded}
            aria-label="Contraer reproductor"
          >
            <Icon name="chevronDown" size={22} />
          </button>
        )}

        {expanded && current && (
          <span className="player__rings" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        )}

        <button
          type="button"
          className="player__meta"
          onClick={openExpanded}
          disabled={!current}
          aria-label="Abrir pantalla completa"
        >
          {current?.thumbnail ? (
            <img src={current.thumbnail} alt="" className="player__art" />
          ) : (
            <div className="player__art player__art--empty" aria-hidden>
              <Icon name="video" size={18} />
            </div>
          )}
          <div className="player__text">
            <span className="player__title">
              {current?.title ?? "Nada sonando"}
            </span>
            <span className="player__artist">
              {current ? (
                <ArtistLinks artists={current.artists} />
              ) : (
                "Elige una canción"
              )}
            </span>
          </div>
        </button>

        <div className="player__center">
          <div className="player__transport">
            <button onClick={prev} aria-label="Anterior">
              <Icon name="skipBack" size={16} />
            </button>
            <button onClick={next} aria-label="Siguiente">
              <Icon name="skipForward" size={16} />
            </button>
          </div>
          <audio ref={audioRef} />
        </div>

        <div className="player__actions">
          <button
            className={
              "player__toggle" +
              (current && isSaved(current.id, library) ? " is-on" : "")
            }
            onClick={() => current && toggleLibrary(current)}
            disabled={!current}
            title={
              current && isSaved(current.id, library)
                ? "Quitar de favoritos"
                : "Añadir a favoritos"
            }
            aria-label="Favorito"
          >
            <Icon
              name="heart"
              size={16}
              filled={!!current && isSaved(current.id, library)}
            />
          </button>
          {current && (
            <AddToPlaylistButton
              track={current}
              className="player__toggle"
              size={16}
            />
          )}
          <button
            className={"player__toggle" + (leveled ? " is-on" : "")}
            onClick={toggleLevel}
            title="Nivelar volumen entre canciones"
            aria-label="Nivelar volumen"
          >
            <Icon name="level" size={16} />
          </button>
          <button
            className={"player__toggle" + (lyricsOpen ? " is-on" : "")}
            onClick={() => setLyricsOpen((v) => !v)}
            title="Letra"
            aria-label="Letra"
          >
            <Icon name="lyrics" size={16} />
          </button>
          <button
            className={"player__toggle" + (radio ? " is-on" : "")}
            onClick={toggleRadio}
            title="Radio: seguir con canciones similares al terminar"
            aria-label="Radio"
          >
            <Icon name="radio" size={16} />
          </button>
          <button
            className={"player__toggle" + (queueOpen ? " is-on" : "")}
            onClick={() => setQueueOpen((v) => !v)}
            title="Cola"
            aria-label="Cola"
          >
            <Icon name="queue" size={16} />
            {queue.length > 0 && (
              <span className="player__badge">{queue.length}</span>
            )}
          </button>
          {current && (
            <a
              className="player__download"
              href={downloadUrl(current.id, "mp3")}
              download
            >
              <Icon name="download" size={14} /> MP3
            </a>
          )}
        </div>
      </footer>
    </>
  );
}
