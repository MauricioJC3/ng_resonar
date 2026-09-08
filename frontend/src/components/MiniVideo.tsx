import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as RPointerEvent,
} from "react";

import type { VideoItem } from "../types";
import { useVideo } from "../state/video";
import Icon from "./Icon";

const POS_KEY = "resonar:mvpos";
const MARGIN = 8;

interface Pos {
  left: number;
  top: number;
}

function loadPos(): Pos | null {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Pos;
    return typeof p?.left === "number" && typeof p?.top === "number" ? p : null;
  } catch {
    return null;
  }
}

function clamp(pos: Pos, el: HTMLElement | null): Pos {
  const w = el?.offsetWidth ?? 340;
  const h = el?.offsetHeight ?? 240;
  const maxLeft = Math.max(MARGIN, window.innerWidth - w - MARGIN);
  const maxTop = Math.max(MARGIN, window.innerHeight - h - MARGIN);
  return {
    left: Math.min(Math.max(MARGIN, pos.left), maxLeft),
    top: Math.min(Math.max(MARGIN, pos.top), maxTop),
  };
}

/**
 * Floating video mini-player. Shown while a video is loaded and the full watch
 * view is NOT on screen. It borrows the persistent player node from
 * `VideoProvider`, so playback continues uninterrupted when the user switches
 * tabs. Its buttons drive the same live Plyr instance, and it can be dragged
 * anywhere on screen by its top bar (position is remembered).
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

  const rootRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    baseLeft: number;
    baseTop: number;
  } | null>(null);
  const [pos, setPos] = useState<Pos | null>(() => loadPos());
  const [dragging, setDragging] = useState(false);

  // Stable ref callback: a fresh arrow each render would thrash the node in and
  // out on every re-render.
  const setMount = useCallback(
    (el: HTMLDivElement | null) => attachTo(el, "mini"),
    [attachTo],
  );

  // Keep it on screen when the window is resized.
  useEffect(() => {
    if (!pos) return;
    const onResize = () => setPos((p) => (p ? clamp(p, rootRef.current) : p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [pos]);

  function onHandleDown(e: RPointerEvent) {
    // Ignore presses that land on a control inside the bar.
    if ((e.target as HTMLElement).closest("button")) return;
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      baseLeft: rect.left,
      baseTop: rect.top,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  }

  function onHandleMove(e: RPointerEvent) {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const next = clamp(
      {
        left: d.baseLeft + (e.clientX - d.startX),
        top: d.baseTop + (e.clientY - d.startY),
      },
      rootRef.current,
    );
    setPos(next);
  }

  function endDrag(e: RPointerEvent) {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    setPos((p) => {
      if (p) {
        try {
          localStorage.setItem(POS_KEY, JSON.stringify(p));
        } catch {
          /* ignore */
        }
      }
      return p;
    });
  }

  if (!current || hidden) return null;

  const style = pos
    ? { left: pos.left, top: pos.top, right: "auto", bottom: "auto" }
    : undefined;

  return (
    <div
      ref={rootRef}
      className={"mini-video" + (dragging ? " mini-video--dragging" : "")}
      style={style}
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

      <div
        className="mini-video__bar"
        onPointerDown={onHandleDown}
        onPointerMove={onHandleMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <span className="mini-video__grip" aria-hidden="true">
          <Icon name="grip" size={14} />
        </span>
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
