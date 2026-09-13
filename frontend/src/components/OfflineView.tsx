import { useMemo, useState } from "react";

import { offlineTotalSize, useOfflineTracks } from "../state/offline";
import type { OfflineTrack } from "../state/offline";
import { usePlayer } from "../state/player";
import { useListKeyboard } from "../lib/useListKeyboard";
import { shuffled } from "../lib/shuffle";
import Icon from "./Icon";
import TrackRow from "./TrackRow";

function humanSize(bytes: number): string {
  const mb = bytes / 1_048_576;
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;
}

interface AlbumGroup {
  album: string;
  thumbnail: string | null;
  tracks: OfflineTrack[];
}

/**
 * Downloaded tracks that carry an `album` name group under "Álbumes" (so a
 * fully-downloaded album stays organized instead of dissolving into loose
 * songs); everything else — singles, favorites downloaded one at a time —
 * lands under "Canciones". Grouping is by album title alone (no album id is
 * stored per track), so two different albums that happen to share a title
 * would merge — an edge case rare enough not to worry about here.
 */
export function groupByAlbum(tracks: OfflineTrack[]): {
  albums: AlbumGroup[];
  loose: OfflineTrack[];
} {
  const byAlbum = new Map<string, OfflineTrack[]>();
  const loose: OfflineTrack[] = [];
  for (const t of tracks) {
    if (t.album) {
      const list = byAlbum.get(t.album) ?? [];
      list.push(t);
      byAlbum.set(t.album, list);
    } else {
      loose.push(t);
    }
  }
  const albums = [...byAlbum.entries()].map(([album, albumTracks]) => ({
    album,
    thumbnail: albumTracks.find((t) => t.thumbnail)?.thumbnail ?? null,
    tracks: albumTracks,
  }));
  return { albums, loose };
}

export default function OfflineView() {
  const [tab, setTab] = useState<"albums" | "songs">("albums");
  const [openAlbum, setOpenAlbum] = useState<string | null>(null);
  const offline = useOfflineTracks();
  const { playList } = usePlayer();

  const { albums, loose } = useMemo(() => groupByAlbum(offline), [offline]);
  const activeAlbum = openAlbum
    ? albums.find((a) => a.album === openAlbum) ?? null
    : null;

  const { activeIndex, listRef } = useListKeyboard(
    tab === "songs" && !activeAlbum ? loose.length : 0,
    (i) => playList(loose, i),
  );

  const readyCount = offline.filter((t) => t.status === "ready").length;

  if (offline.length === 0) {
    return (
      <div className="view">
        <h1 className="view__title">Sin conexión</h1>
        <div className="empty">
          <p>Nada descargado para escuchar sin conexión.</p>
          <p className="empty__sub">
            Pulsa <Icon name="offline" size={13} /> en una canción, álbum o
            playlist para tenerla disponible sin internet.
          </p>
        </div>
      </div>
    );
  }

  if (activeAlbum) {
    return (
      <div className="view">
        <button className="watch__back" onClick={() => setOpenAlbum(null)}>
          <Icon name="back" size={16} /> Volver
        </button>

        <div className="pldetail__head">
          <div className="pldetail__art">
            {activeAlbum.thumbnail ? (
              <img src={activeAlbum.thumbnail} alt="" />
            ) : (
              <Icon name="list" size={30} />
            )}
          </div>
          <div className="pldetail__meta">
            <h1>{activeAlbum.album}</h1>
            <p>
              {[
                `${activeAlbum.tracks.length} pistas`,
                humanSize(offlineTotalSize(activeAlbum.tracks)),
              ].join(" · ")}
            </p>
            <div className="pldetail__actions">
              <button
                className="btn btn--accent"
                onClick={() => playList(activeAlbum.tracks, 0)}
              >
                <Icon name="play" size={14} filled /> Reproducir
              </button>
              <button
                className="btn"
                onClick={() => playList(shuffled(activeAlbum.tracks), 0)}
              >
                <Icon name="shuffle" size={14} /> Aleatorio
              </button>
            </div>
          </div>
        </div>

        <div className="tracklist">
          {activeAlbum.tracks.map((track, i) => (
            <TrackRow
              key={track.id}
              track={track}
              index={i}
              onPlay={() => playList(activeAlbum.tracks, i)}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="view">
      <h1 className="view__title">Sin conexión</h1>
      <p className="hint">
        {readyCount} canción{readyCount === 1 ? "" : "es"} ·{" "}
        {humanSize(offlineTotalSize(offline))}
      </p>

      <div className="segmented">
        <button
          className={tab === "albums" ? "is-on" : ""}
          onClick={() => setTab("albums")}
        >
          Álbumes{albums.length > 0 ? ` (${albums.length})` : ""}
        </button>
        <button
          className={tab === "songs" ? "is-on" : ""}
          onClick={() => setTab("songs")}
        >
          Canciones{loose.length > 0 ? ` (${loose.length})` : ""}
        </button>
      </div>

      {tab === "albums" &&
        (albums.length === 0 ? (
          <div className="empty">
            <p>No tienes álbumes completos descargados.</p>
            <p className="empty__sub">
              Descarga un álbum entero desde su página para que aparezca aquí.
            </p>
          </div>
        ) : (
          <div className="albumgrid">
            {albums.map((a) => (
              <button
                key={a.album}
                className="albumcard"
                onClick={() => setOpenAlbum(a.album)}
              >
                <span className="albumcard__art">
                  {a.thumbnail ? (
                    <img src={a.thumbnail} alt="" loading="lazy" />
                  ) : (
                    <Icon name="list" size={22} />
                  )}
                </span>
                <span className="albumcard__title">{a.album}</span>
                <span className="albumcard__meta">
                  {a.tracks.length} canción{a.tracks.length === 1 ? "" : "es"}
                </span>
              </button>
            ))}
          </div>
        ))}

      {tab === "songs" &&
        (loose.length === 0 ? (
          <div className="empty">
            <p>No tienes canciones sueltas descargadas.</p>
            <p className="empty__sub">
              Las canciones que descargues fuera de un álbum aparecen aquí.
            </p>
          </div>
        ) : (
          <div className="tracklist" ref={listRef}>
            {loose.map((track, i) => (
              <TrackRow
                key={track.id}
                track={track}
                index={i}
                selected={i === activeIndex}
                onPlay={() => playList(loose, i)}
              />
            ))}
          </div>
        ))}
    </div>
  );
}
