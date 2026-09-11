import { useEffect, useState } from "react";

import type { View } from "../App";
import { isSaved, toggleLibrary, useLibrary } from "../state/library";
import { hasTrackDrag, readTrackDrag } from "../lib/dnd";
import Icon from "./Icon";

const COLLAPSE_KEY = "resonar:navcollapsed";

// `mobilePrimary: false` items still show on the desktop rail but drop out of
// the mobile bottom bar (5 tabs fit; 7 wrapped their labels unevenly on
// narrow screens). Reachable on mobile from "Ajustes" > Accesos rápidos.
const NAV: { id: View; label: string; icon: string; mobilePrimary?: boolean }[] = [
  { id: "home", label: "Inicio", icon: "home" },
  { id: "search", label: "Buscar", icon: "search" },
  { id: "videos", label: "Videos", icon: "video", mobilePrimary: false },
  { id: "playlists", label: "Playlists", icon: "list" },
  { id: "library", label: "Biblioteca", icon: "heart" },
  { id: "history", label: "Historial", icon: "history", mobilePrimary: false },
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
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  return (
    <nav
      className={"nav" + (collapsed ? " nav--collapsed" : "")}
      aria-label="Navegación principal"
    >
      <div className="nav__brand">
        <span className="nav__logo" aria-hidden>
          ◈
        </span>
        <span className="nav__label">Resonar</span>
        <button
          type="button"
          className="nav__collapse"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expandir el menú" : "Recoger el menú"}
          aria-pressed={collapsed}
          title={collapsed ? "Expandir el menú" : "Recoger el menú"}
        >
          <Icon name="sidebar" size={17} />
        </button>
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
                (isLibrary && dropActive ? " nav__item--drop" : "") +
                (item.mobilePrimary === false ? " nav__item--desktop-only" : "")
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
