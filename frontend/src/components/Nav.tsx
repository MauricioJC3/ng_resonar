import { useState } from "react";

import type { View } from "../App";
import { isSaved, toggleLibrary, useLibrary } from "../state/library";
import { hasTrackDrag, readTrackDrag } from "../lib/dnd";
import Icon from "./Icon";

const NAV: { id: View; label: string; icon: string }[] = [
  { id: "home", label: "Inicio", icon: "home" },
  { id: "search", label: "Buscar", icon: "search" },
  { id: "videos", label: "Videos", icon: "video" },
  { id: "playlists", label: "Playlists", icon: "list" },
  { id: "library", label: "Biblioteca", icon: "heart" },
  { id: "history", label: "Historial", icon: "history" },
  { id: "settings", label: "Ajustes", icon: "settings" },
];

export default function Nav({
  view,
  onNavigate,
  onLogout,
}: {
  view: View;
  onNavigate: (v: View) => void;
  onLogout?: () => void;
}) {
  const library = useLibrary();
  const [dropActive, setDropActive] = useState(false);

  return (
    <nav className="nav" aria-label="Navegación principal">
      <div className="nav__brand">
        <span className="nav__logo" aria-hidden>
          ◈
        </span>
        <span className="nav__label">Resonar</span>
      </div>

      <div className="nav__items">
        {NAV.map((item) => {
          const active = view === item.id;
          const isLibrary = item.id === "library";
          return (
            <button
              key={item.id}
              className={
                "nav__item" +
                (active ? " is-active" : "") +
                (isLibrary && dropActive ? " nav__item--drop" : "")
              }
              onClick={() => onNavigate(item.id)}
              aria-current={active ? "page" : undefined}
              title={
                isLibrary
                  ? "Biblioteca — suelta una canción aquí para guardarla"
                  : item.label
              }
              onDragOver={
                isLibrary
                  ? (e) => {
                      if (!hasTrackDrag(e)) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "copy";
                      setDropActive(true);
                    }
                  : undefined
              }
              onDragLeave={isLibrary ? () => setDropActive(false) : undefined}
              onDrop={
                isLibrary
                  ? (e) => {
                      e.preventDefault();
                      setDropActive(false);
                      const track = readTrackDrag(e);
                      if (track && !isSaved(track.id, library))
                        toggleLibrary(track);
                    }
                  : undefined
              }
            >
              <Icon name={item.icon} size={18} />
              <span className="nav__label">{item.label}</span>
              {item.id === "library" && library.length > 0 && (
                <span className="nav__count">{library.length}</span>
              )}
            </button>
          );
        })}
      </div>

      {onLogout && (
        <button
          type="button"
          className="btn btn--ghost nav__logout"
          onClick={onLogout}
        >
          <Icon name="settings" size={16} />
          <span className="nav__label">Cerrar sesión</span>
        </button>
      )}

      <p className="nav__note">
        Reproducción y descargas desde fuentes públicas. Pensado para uso
        personal.
      </p>
    </nav>
  );
}
