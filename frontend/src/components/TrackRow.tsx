import { useState } from "react";

import { downloadUrl } from "../api";
import type { DownloadFormat, Track } from "../types";
import { toggleLibrary, useLibrary, isSaved } from "../state/library";
import { addToPlaylist, createPlaylist, usePlaylists } from "../state/playlists";
import { usePlayer } from "../state/player";
import Icon from "./Icon";

const FORMATS: DownloadFormat[] = ["mp3", "m4a", "opus", "flac"];

export default function TrackRow({
  track,
  index,
  onPlay,
}: {
  track: Track;
  index: number;
  onPlay: () => void;
}) {
  const { current } = usePlayer();
  const library = useLibrary();
  const playlists = usePlaylists();
  const [menu, setMenu] = useState<null | "dl" | "pl">(null);

  const active = current?.id === track.id;
  const saved = isSaved(track.id, library);

  async function addTo(id: string) {
    setMenu(null);
    await addToPlaylist(id, track);
  }

  async function addToNew() {
    setMenu(null);
    const name = window.prompt("Nombre de la nueva playlist");
    if (!name) return;
    const pl = await createPlaylist(name);
    await addToPlaylist(pl.id, track);
  }

  return (
    <div className={"track" + (active ? " track--active" : "")}>
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
          <span className="track__artist">{track.artists.join(", ")}</span>
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

        <div className="track__dl">
          <button
            className="track__icon"
            title="Añadir a playlist"
            onClick={() => setMenu((m) => (m === "pl" ? null : "pl"))}
            onBlur={() => window.setTimeout(() => setMenu(null), 160)}
          >
            <Icon name="plus" size={16} />
          </button>
          {menu === "pl" && (
            <ul className="track__menu track__menu--wide">
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
            </ul>
          )}
        </div>

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
