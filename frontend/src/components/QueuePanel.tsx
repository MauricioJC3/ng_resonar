import { useState } from "react";

import { isSaved, toggleLibrary, useLibrary } from "../state/library";
import { usePlayer } from "../state/player";
import { setTrackDrag } from "../lib/dnd";
import AddToPlaylistButton from "./AddToPlaylistButton";
import ArtistLinks from "./ArtistLinks";
import Icon from "./Icon";

export default function QueuePanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { queue, index, jumpTo, removeAt, move, shuffle } = usePlayer();
  const library = useLibrary();

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  function endDrag() {
    setDragIndex(null);
    setOverIndex(null);
  }

  function onDrop(to: number) {
    if (dragIndex !== null && dragIndex !== to) move(dragIndex, to);
    endDrag();
  }

  return (
    <aside
      className={"drawer" + (open ? " drawer--open" : "")}
      role="complementary"
      aria-label="Cola de reproducción"
      aria-hidden={!open}
    >
      <header className="drawer__head">
        <span>Cola · {queue.length}</span>
        <div className="drawer__head-actions">
          <button
            onClick={shuffle}
            disabled={queue.length < 3}
            aria-label="Mezclar la cola"
            title="Mezclar la cola"
          >
            <Icon name="shuffle" size={15} />
          </button>
          <button onClick={onClose} aria-label="Cerrar la cola" title="Cerrar">
            <Icon name="x" size={16} />
          </button>
        </div>
      </header>

      <div className="drawer__list">
        {queue.length === 0 && (
          <p className="drawer__empty">La cola está vacía.</p>
        )}

        {queue.map((track, i) => (
          <div
            key={track.id + i}
            className={
              "qrow" +
              (i === index ? " qrow--now" : "") +
              (i === dragIndex ? " qrow--dragging" : "") +
              (i === overIndex && dragIndex !== null && i !== dragIndex
                ? " qrow--over"
                : "")
            }
            draggable
            onDragStart={(e) => {
              setDragIndex(i);
              setTrackDrag(e, track);
            }}
            onDragEnd={endDrag}
            onDragOver={(e) => {
              e.preventDefault();
              if (dragIndex !== null) setOverIndex(i);
            }}
            onDrop={(e) => {
              e.preventDefault();
              onDrop(i);
            }}
          >
            <span
              className="qrow__grip"
              aria-hidden="true"
              title="Arrastra para reordenar"
            >
              <Icon name="grip" size={14} />
            </span>
            <button className="qrow__main" onClick={() => jumpTo(i)}>
              <img src={track.thumbnail ?? ""} alt="" loading="lazy" />
              <span className="qrow__text">
                <span className="qrow__title">{track.title}</span>
                <span className="qrow__artist">
                  <ArtistLinks artists={track.artists} />
                </span>
              </span>
            </button>
            <div className="qrow__ctl">
              <AddToPlaylistButton track={track} className="" size={13} />
              <button
                className={isSaved(track.id, library) ? "is-on" : ""}
                onClick={() => toggleLibrary(track)}
                aria-label={
                  isSaved(track.id, library)
                    ? "Quitar de favoritos"
                    : "Añadir a favoritos"
                }
                title={
                  isSaved(track.id, library)
                    ? "Quitar de favoritos"
                    : "Añadir a favoritos"
                }
              >
                <Icon
                  name="heart"
                  size={13}
                  filled={isSaved(track.id, library)}
                />
              </button>
              <button onClick={() => removeAt(i)} aria-label="Quitar de la cola">
                <Icon name="x" size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
