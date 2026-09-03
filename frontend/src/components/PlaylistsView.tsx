import { useState } from "react";

import { createPlaylist, usePlaylists } from "../state/playlists";
import Icon from "./Icon";

export default function PlaylistsView({
  onOpen,
}: {
  onOpen: (id: string) => void;
}) {
  const lists = usePlaylists();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function newEmpty() {
    const name = window.prompt("Nombre de la playlist");
    if (!name) return;
    setError("");
    try {
      const pl = await createPlaylist(name);
      onOpen(pl.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    }
  }

  async function importUrl() {
    const url = window.prompt(
      "Pega la URL de una playlist o álbum de YouTube / YouTube Music",
    );
    if (!url) return;
    setBusy(true);
    setError("");
    try {
      const pl = await createPlaylist("", url);
      onOpen(pl.id);
    } catch (e) {
      setError(
        e instanceof Error && e.message.includes("422")
          ? "No se encontraron pistas en esa URL."
          : "No se pudo importar.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="view">
      <div className="view__bar">
        <h1 className="view__title">Playlists</h1>
        <div className="view__bar-actions">
          <button className="btn" onClick={newEmpty}>
            <Icon name="plus" size={15} /> Nueva
          </button>
          <button className="btn" onClick={importUrl} disabled={busy}>
            {busy ? <span className="spinner" /> : <Icon name="list" size={15} />}{" "}
            Importar de URL
          </button>
        </div>
      </div>

      {error && <p className="hint hint--error">{error}</p>}

      {lists.length === 0 ? (
        <div className="empty">
          <p>Aún no tienes playlists.</p>
          <p className="empty__sub">
            Crea una, o importa desde una URL de YouTube / YT Music.
          </p>
        </div>
      ) : (
        <div className="plgrid">
          {lists.map((pl) => (
            <button
              key={pl.id}
              className="plcard"
              onClick={() => onOpen(pl.id)}
            >
              <span className="plcard__art">
                {pl.thumbnail ? (
                  <img src={pl.thumbnail} alt="" loading="lazy" />
                ) : (
                  <Icon name="list" size={24} />
                )}
              </span>
              <span className="plcard__name">{pl.name}</span>
              <span className="plcard__count">{pl.count} pistas</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
