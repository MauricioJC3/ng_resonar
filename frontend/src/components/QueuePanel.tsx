import { type DragEvent, useState } from "react";

import { isSaved, toggleLibrary, useLibrary } from "../state/library";
import { usePlayer } from "../state/player";
import { hasTrackDrag, readTrackDrag, setTrackDrag } from "../lib/dnd";
import { useListKeyboard } from "../lib/useListKeyboard";
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
  const { queue, index, jumpTo, removeAt, move, shuffle, enqueue } = usePlayer();
  const library = useLibrary();

  // Spotify-style: only the current track and what's coming up is shown; a
  // finished song drops off the list but is still in the queue, so pressing
  // "anterior" brings it right back. Indices below are local to this slice;
  // `index + vi` maps back to the real queue.
  const visible = queue.slice(index);

  // Reordering a visible row: this holds its local index. External drags (a
  // track dragged in from a list) leave it null.
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const [dropHot, setDropHot] = useState(false);

  function endDrag() {
    setDragIndex(null);
    setOverIndex(null);
    setDropHot(false);
  }

  // Only owns the arrow keys while the drawer is actually open — it stays
  // mounted (just collapsed via CSS) so the drawer being in the DOM isn't
  // enough on its own.
  const { activeIndex, listRef } = useListKeyboard(
    visible.length,
    (vi) => jumpTo(index + vi),
    open,
  );

  function onRowDrop(to: number, e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (dragIndex !== null) {
      if (dragIndex !== to) move(index + dragIndex, index + to);
    } else {
      const track = readTrackDrag(e);
      if (track) enqueue(track);
    }
    endDrag();
  }

  return (
    <aside
      className={
        "drawer" +
        (open ? " drawer--open" : "") +
        (dropHot ? " drawer--drop" : "")
      }
      role="complementary"
      aria-label="Cola de reproducción"
      aria-hidden={!open}
    >
      <header className="drawer__head">
        <span>Cola · {visible.length}</span>
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

      <div
        className="drawer__list"
        ref={listRef}
        onDragOver={(e) => {
          // Allow dropping a track dragged in from a list.
          if (dragIndex === null && hasTrackDrag(e)) {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
            setDropHot(true);
          }
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node))
            setDropHot(false);
        }}
        onDrop={(e) => {
          if (dragIndex !== null) return; // a row handler took it
          const track = readTrackDrag(e);
          if (track) {
            e.preventDefault();
            enqueue(track);
          }
          endDrag();
        }}
      >
        {visible.length === 0 && (
          <p className="drawer__empty">
            La cola está vacía. Arrastra canciones aquí o usa el botón de cola.
          </p>
        )}

        {visible.map((track, vi) => (
          <div
            key={track.id + (index + vi)}
            className={
              "qrow" +
              (vi === 0 ? " qrow--now" : "") +
              (vi === dragIndex ? " qrow--dragging" : "") +
              (vi === overIndex && dragIndex !== null && vi !== dragIndex
                ? " qrow--over"
                : "") +
              (vi === activeIndex ? " qrow--selected" : "")
            }
            aria-selected={vi === activeIndex || undefined}
            draggable
            onDragStart={(e) => {
              setDragIndex(vi);
              setTrackDrag(e, track);
            }}
            onDragEnd={endDrag}
            onDragOver={(e) => {
              e.preventDefault();
              if (dragIndex !== null) setOverIndex(vi);
            }}
            onDrop={(e) => onRowDrop(vi, e)}
          >
            <span
              className="qrow__grip"
              aria-hidden="true"
              title="Arrastra para reordenar"
            >
              <Icon name="grip" size={14} />
            </span>
            <button
              className="qrow__main"
              onClick={() => jumpTo(index + vi)}
            >
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
              <button
                onClick={() => removeAt(index + vi)}
                aria-label="Quitar de la cola"
              >
                <Icon name="x" size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
