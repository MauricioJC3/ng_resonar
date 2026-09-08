import { useState } from "react";

import { downloadUrl } from "../api";
import type { DownloadFormat, Track } from "../types";
import { toggleLibrary, useLibrary, isSaved } from "../state/library";
import { usePlayer } from "../state/player";
import { setTrackDrag } from "../lib/dnd";
import AddToPlaylistButton from "./AddToPlaylistButton";
import ArtistLinks from "./ArtistLinks";
import Icon from "./Icon";

const FORMATS: DownloadFormat[] = ["mp3", "m4a", "opus", "flac"];

export default function TrackRow({
  track,
  index,
  onPlay,
  selected = false,
}: {
  track: Track;
  index: number;
  onPlay: () => void;
  /** Highlighted by keyboard list navigation. */
  selected?: boolean;
}) {
  const { current, enqueue } = usePlayer();
  const library = useLibrary();
  const [menu, setMenu] = useState<null | "dl">(null);
  const [queued, setQueued] = useState(false);

  const active = current?.id === track.id;
  const saved = isSaved(track.id, library);

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
      draggable
      onDragStart={(e) => setTrackDrag(e, track)}
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
          className={"track__icon" + (saved ? " is-on" : "")}
          title={saved ? "Quitar de favoritos" : "Guardar en favoritos"}
          onClick={() => toggleLibrary(track)}
        >
          <Icon name="heart" size={16} filled={saved} />
        </button>

        <button
          className={"track__icon" + (queued ? " is-on" : "")}
          title={queued ? "Añadida a la cola" : "Añadir a la cola"}
          aria-label="Añadir a la cola"
          onClick={addToQueue}
        >
          <Icon name={queued ? "check" : "queue"} size={16} />
        </button>

        <AddToPlaylistButton track={track} />

        <div className="track__dl">
          <button
            className="track__icon"
            title="Descargar"
            onClick={() => setMenu((m) => (m === "dl" ? null : "dl"))}
            onBlur={() => window.setTimeout(() => setMenu(null), 160)}
          >
            <Icon name="download" size={16} />
          </button>
          {menu === "dl" && (
            <ul className="track__menu">
              {FORMATS.map((f) => (
                <li key={f}>
                  <a href={downloadUrl(track.id, f)} download>
                    {f.toUpperCase()}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
