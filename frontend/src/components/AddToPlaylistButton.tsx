import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { Track } from "../types";
import { addToPlaylist, createPlaylist, usePlaylists } from "../state/playlists";
import Icon from "./Icon";

/**
 * "Add this track to a playlist" — a small button whose menu (the user's
 * playlists + "new playlist") is portalled to <body> and positioned against the
 * button, so it works from the track rows, the queue drawer and the player bar
 * alike without being clipped by a scroll container.
 */
export default function AddToPlaylistButton({
  track,
  className = "track__icon",
  size = 16,
}: {
  track: Track;
  className?: string;
  size?: number;
}) {
  const playlists = usePlaylists();
  const btnRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; bottom: number }>({
    left: 0,
    bottom: 0,
  });

  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ left: r.right, bottom: window.innerHeight - r.top + 6 });
    }
    setOpen((o) => !o);
  }

  // Any scroll / resize would leave the menu floating in the wrong place.
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  async function addTo(id: string) {
    setOpen(false);
    await addToPlaylist(id, track);
  }

  async function addToNew() {
    setOpen(false);
    const name = window.prompt("Nombre de la nueva playlist");
    if (!name) return;
    const pl = await createPlaylist(name);
    await addToPlaylist(pl.id, track);
  }

  return (
    <>
      <button
        ref={btnRef}
        className={className}
        title="Añadir a una playlist"
        aria-label="Añadir a una playlist"
        onClick={toggle}
        onBlur={() => window.setTimeout(() => setOpen(false), 160)}
      >
        <Icon name="plus" size={size} />
      </button>
      {open &&
        createPortal(
          <ul
            className="track__menu track__menu--wide track__menu--float"
            style={{ left: pos.left, bottom: pos.bottom }}
          >
            {playlists.length === 0 && (
              <li className="track__menu-empty">Sin playlists</li>
            )}
            {playlists.map((p) => (
              <li key={p.id}>
                <button onMouseDown={() => addTo(p.id)}>{p.name}</button>
              </li>
            ))}
            <li className="track__menu-sep">
              <button onMouseDown={addToNew}>＋ Nueva playlist…</button>
            </li>
          </ul>,
          document.body,
        )}
    </>
  );
}
