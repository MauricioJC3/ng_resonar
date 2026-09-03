import type { View } from "../App";
import { useLibrary } from "../state/library";
import Icon from "./Icon";

const NAV: { id: View; label: string; icon: string }[] = [
  { id: "search", label: "Buscar", icon: "search" },
  { id: "videos", label: "Videos", icon: "video" },
  { id: "playlists", label: "Playlists", icon: "list" },
  { id: "library", label: "Biblioteca", icon: "heart" },
  { id: "settings", label: "Ajustes", icon: "settings" },
];

export default function Sidebar({
  view,
  onNavigate,
}: {
  view: View;
  onNavigate: (v: View) => void;
}) {
  const library = useLibrary();

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <span className="sidebar__logo" aria-hidden>
          ◈
        </span>
        <span className="sidebar__label">Resonar</span>
      </div>

      <nav className="sidebar__nav">
        {NAV.map((item) => (
          <button
            key={item.id}
            className={view === item.id ? "is-active" : ""}
            onClick={() => onNavigate(item.id)}
            title={item.label}
          >
            <Icon name={item.icon} size={18} />
            <span className="sidebar__label">{item.label}</span>
            {item.id === "library" && library.length > 0 && (
              <span className="sidebar__count">{library.length}</span>
            )}
          </button>
        ))}
      </nav>

      <p className="sidebar__note">
        Reproducción y descargas desde fuentes públicas. Pensado para uso
        personal.
      </p>
    </aside>
  );
}
