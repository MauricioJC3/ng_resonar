import { usePlayer } from "../state/player";
import Icon from "./Icon";

export default function QueuePanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { queue, index, jumpTo, removeAt, move } = usePlayer();

  if (!open) return null;

  return (
    <>
      <div className="drawer__scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label="Cola de reproducción">
        <header className="drawer__head">
          <span>Cola · {queue.length}</span>
          <button onClick={onClose} aria-label="Cerrar">
            <Icon name="x" size={16} />
          </button>
        </header>

        <div className="drawer__list">
          {queue.length === 0 && <p className="drawer__empty">La cola está vacía.</p>}

          {queue.map((track, i) => (
            <div
              key={track.id + i}
              className={"qrow" + (i === index ? " qrow--now" : "")}
            >
              <button className="qrow__main" onClick={() => jumpTo(i)}>
                <img src={track.thumbnail ?? ""} alt="" loading="lazy" />
                <span className="qrow__text">
                  <span className="qrow__title">{track.title}</span>
                  <span className="qrow__artist">{track.artists.join(", ")}</span>
                </span>
              </button>
              <div className="qrow__ctl">
                <button
                  disabled={i === 0}
                  onClick={() => move(i, i - 1)}
                  aria-label="Subir"
                >
                  ↑
                </button>
                <button
                  disabled={i === queue.length - 1}
                  onClick={() => move(i, i + 1)}
                  aria-label="Bajar"
                >
                  ↓
                </button>
                <button onClick={() => removeAt(i)} aria-label="Quitar">
                  <Icon name="x" size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}
