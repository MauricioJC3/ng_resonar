import { useState } from "react";

import { downloadUrl } from "../api";
import type { Track } from "../types";
import { usePlayer } from "../state/player";
import ArtistLinks from "./ArtistLinks";
import Icon from "./Icon";

export default function PlaylistTrackRow({
  track,
  index,
  onPlay,
  onRemove,
  onUp,
  onDown,
  selected = false,
}: {
  track: Track;
  index: number;
  onPlay: () => void;
  onRemove: () => void;
  onUp?: () => void;
  onDown?: () => void;
  /** Highlighted by keyboard list navigation. */
  selected?: boolean;
}) {
  const { current, enqueue } = usePlayer();
  const active = current?.id === track.id;
  const [queued, setQueued] = useState(false);

  function addToQueue() {
    enqueue(track);
    setQueued(true);
    window.setTimeout(() => setQueued(false), 1200);
  }

  return (
    <div
      className={
        "track" +
        (active ? " track--active" : "") +
        (selected ? " track--selected" : "")
      }
      aria-selected={selected || undefined}
    >
      <span className="track__index">
        {active ? (
          <span className="eq" aria-label="Sonando">
            <i />
            <i />
            <i />
          </span>
        ) : (
          index + 1
        )}
      </span>

      <button className="track__main" onClick={onPlay}>
        <span className="track__art">
          <img src={track.thumbnail ?? ""} alt="" loading="lazy" />
          <span className="track__art-play">
            <Icon name="play" size={16} filled />
          </span>
        </span>
        <span className="track__info">
          <span className="track__title">{track.title}</span>
          <span className="track__artist">
            <ArtistLinks artists={track.artists} />
          </span>
        </span>
      </button>

      <span className="track__album">{track.album}</span>
      <span className="track__dur">{track.duration}</span>

      <div className="track__actions">
        <button
          className={"track__icon" + (queued ? " is-on" : "")}
          title={queued ? "Añadida a la cola" : "Añadir a la cola"}
          aria-label="Añadir a la cola"
          onClick={addToQueue}
        >
          <Icon name={queued ? "check" : "queue"} size={16} />
        </button>
        <button
          className="track__icon"
          title="Subir"
          onClick={onUp}
          disabled={!onUp}
        >
          ↑
        </button>
        <button
          className="track__icon"
          title="Bajar"
          onClick={onDown}
          disabled={!onDown}
        >
          ↓
        </button>
        <a
          className="track__icon"
          href={downloadUrl(track.id, "mp3")}
          download
          title="Descargar MP3"
        >
          <Icon name="download" size={16} />
        </a>
        <button
          className="track__icon"
          title="Quitar de la playlist"
          onClick={onRemove}
        >
          <Icon name="x" size={16} />
        </button>
      </div>
    </div>
  );
}
