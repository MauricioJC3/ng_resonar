import { useCallback } from "react";

import type { VideoItem } from "../types";
import { useVideo } from "../state/video";
import Icon from "./Icon";

/**
 * Floating video mini-player. Shown while a video is loaded and the full watch
 * view is NOT on screen. It borrows the persistent player node from
 * `VideoProvider`, so playback continues uninterrupted when the user switches
 * tabs. Its buttons drive the same live Plyr instance.
 */
export default function MiniVideo({
  hidden,
  onExpand,
}: {
  hidden?: boolean;
  onExpand: (v: VideoItem) => void;
}) {
  const { current, paused, togglePlay, seekBy, closeVideo, attachTo } =
    useVideo();

  // Stable ref callback: a fresh arrow each render would thrash the node in and
  // out on every re-render.
  const setMount = useCallback(
    (el: HTMLDivElement | null) => attachTo(el, "mini"),
    [attachTo],
  );

  if (!current || hidden) return null;

  return (
    <div
      className="mini-video"
      role="region"
      aria-label={`Mini reproductor: ${current.title}`}
    >
      <div className="mini-video__stage">
        <div className="mini-video__mount" ref={setMount} />
        <button
          className="mini-video__expand"
          onClick={() => onExpand(current)}
          aria-label="Abrir en pantalla completa"
          title="Abrir en pantalla completa"
        >
          <Icon name="chevronUp" size={16} />
        </button>
        <button
          className="mini-video__close"
          onClick={closeVideo}
          aria-label="Cerrar video"
          title="Cerrar video"
        >
          <Icon name="x" size={15} />
        </button>
      </div>

      <div className="mini-video__bar">
        <button
          onClick={() => seekBy(-10)}
          aria-label="Retroceder 10 segundos"
          title="−10 s"
        >
          <Icon name="skipBack" size={15} />
        </button>
        <button
          className="mini-video__play"
          onClick={togglePlay}
          aria-label={paused ? "Reproducir" : "Pausar"}
        >
          <Icon name={paused ? "play" : "pause"} size={16} />
        </button>
        <button
          onClick={() => seekBy(10)}
          aria-label="Adelantar 10 segundos"
          title="+10 s"
        >
          <Icon name="skipForward" size={15} />
        </button>
        <span className="mini-video__title" title={current.title}>
          {current.title}
        </span>
      </div>
    </div>
  );
}
