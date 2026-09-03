import { useEffect, useRef, useState } from "react";

import { getLyrics } from "../api";
import type { Lyrics } from "../types";
import { usePlayer } from "../state/player";
import { seek, useNowPlaying } from "../state/nowPlaying";
import Icon from "./Icon";

export default function LyricsPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { current } = usePlayer();
  const { time } = useNowPlaying();
  const [lyrics, setLyrics] = useState<Lyrics | null>(null);
  const [loading, setLoading] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !current) return;
    setLyrics(null);
    setLoading(true);
    let alive = true;
    getLyrics(
      current.artists[0] ?? "",
      current.title,
      current.album ?? "",
      current.durationSeconds ?? 0,
    )
      .then((l) => {
        if (alive) setLyrics(l);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open, current?.id]);

  const synced = lyrics?.synced ?? [];
  let activeIdx = -1;
  for (let i = 0; i < synced.length; i++) {
    if (synced[i].time <= time + 0.15) activeIdx = i;
    else break;
  }

  useEffect(() => {
    const c = bodyRef.current;
    if (!c || activeIdx < 0) return;
    const el = c.querySelector<HTMLElement>(`[data-i="${activeIdx}"]`);
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeIdx]);

  if (!open) return null;

  return (
    <>
      <div className="drawer__scrim" onClick={onClose} />
      <div className="lyrics" role="dialog" aria-label="Letra">
        <header className="lyrics__head">
          <div className="lyrics__meta">
            <span className="lyrics__title">{current?.title ?? "—"}</span>
            <span className="lyrics__artist">
              {current?.artists.join(", ")}
            </span>
          </div>
          <button onClick={onClose} aria-label="Cerrar">
            <Icon name="x" size={16} />
          </button>
        </header>

        <div className="lyrics__body" ref={bodyRef}>
          {loading && <p className="hint">Buscando letra…</p>}

          {!loading && synced.length > 0 && (
            <div className="lyrics__synced">
              {synced.map((line, i) => (
                <p
                  key={i}
                  data-i={i}
                  className={"lyrics__line" + (i === activeIdx ? " is-active" : "")}
                  onClick={() => seek(line.time)}
                >
                  {line.text || "♪"}
                </p>
              ))}
            </div>
          )}

          {!loading && synced.length === 0 && lyrics?.plain && (
            <pre className="lyrics__plain">{lyrics.plain}</pre>
          )}

          {!loading && synced.length === 0 && !lyrics?.plain && (
            <p className="hint">No se encontró letra para esta canción.</p>
          )}
        </div>

        {synced.length > 0 && (
          <div className="lyrics__foot">Toca una línea para saltar ahí · LRCLIB</div>
        )}
      </div>
    </>
  );
}
