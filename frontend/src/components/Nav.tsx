import type { View } from "../App";
import { useLibrary } from "../state/library";
import Icon from "./Icon";

const NAV: { id: View; label: string; icon: string }[] = [
  { id: "home", label: "Inicio", icon: "home" },
  { id: "search", label: "Buscar", icon: "search" },
  { id: "videos", label: "Videos", icon: "video" },
  { id: "playlists", label: "Playlists", icon: "list" },
  { id: "library", label: "Biblioteca", icon: "heart" },
  { id: "settings", label: "Ajustes", icon: "settings" },
];

export default function Nav({
  view,
  onNavigate,
}: {
  view: View;
  onNavigate: (v: View) => void;
}) {
  const library = useLibrary();

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
          return (
            <button
              key={item.id}
              className={"nav__item" + (active ? " is-active" : "")}
              onClick={() => onNavigate(item.id)}
              aria-current={active ? "page" : undefined}
              title={item.label}
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

      <p className="nav__note">
        Reproducción y descargas desde fuentes públicas. Pensado para uso
        personal.
      </p>
    </nav>
  );
}
