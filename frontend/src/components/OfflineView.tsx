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

interface PlaylistGroup {
  id: string;
  name: string;
  thumbnail: string | null;
  tracks: OfflineTrack[];
}

/**
 * Tracks downloaded via a playlist's "Sin conexión" button carry that
 * playlist's id/name (see `state/offline.ts`) — pull those out first so a
 * playlist's songs stay together in "Sin conexión" regardless of which
 * album each one originally belongs to. A track downloaded from more than
 * one playlist shows up under each. Whatever's left (downloaded from an
 * album page, or one track at a time) falls through to `groupByAlbum`.
 */
export function groupByPlaylist(tracks: OfflineTrack[]): {
  playlists: PlaylistGroup[];
  rest: OfflineTrack[];
} {
  const byPlaylist = new Map<string, PlaylistGroup>();
  const rest: OfflineTrack[] = [];
  for (const t of tracks) {
    if (!t.playlists?.length) {
      rest.push(t);
      continue;
    }
    for (const p of t.playlists) {
      const group = byPlaylist.get(p.id) ?? {
        id: p.id,
        name: p.name,
        thumbnail: null,
        tracks: [],
      };
      group.tracks.push(t);
      if (!group.thumbnail && t.thumbnail) group.thumbnail = t.thumbnail;
      byPlaylist.set(p.id, group);
    }
  }
  return { playlists: [...byPlaylist.values()], rest };
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

/** Shared "open group" screen for a playlist or album inside Sin conexión. */
function GroupDetail({
  title,
  thumbnail,
  tracks,
  meta,
  onBack,
}: {
  title: string;
  thumbnail: string | null;
  tracks: OfflineTrack[];
  meta: string;
  onBack: () => void;
}) {
  const { playList } = usePlayer();
  return (
    <div className="view">
      <button className="watch__back" onClick={onBack}>
        <Icon name="back" size={16} /> Volver
      </button>

      <div className="pldetail__head">
        <div className="pldetail__art">
          {thumbnail ? (
            <img src={thumbnail} alt="" />
          ) : (
            <Icon name="list" size={30} />
          )}
        </div>
        <div className="pldetail__meta">
          <h1>{title}</h1>
          <p>{meta}</p>
          <div className="pldetail__actions">
            <button
              className="btn btn--accent"
              onClick={() => playList(tracks, 0)}
            >
              <Icon name="play" size={14} filled /> Reproducir
            </button>
            <button
              className="btn"
              onClick={() => playList(shuffled(tracks), 0)}
            >
              <Icon name="shuffle" size={14} /> Aleatorio
            </button>
          </div>
        </div>
      </div>

      <div className="tracklist">
        {tracks.map((track, i) => (
          <TrackRow
            key={track.id}
            track={track}
            index={i}
            onPlay={() => playList(tracks, i)}
          />
        ))}
      </div>
    </div>
  );
}

export default function OfflineView() {
  const [tab, setTab] = useState<"playlists" | "albums" | "songs">("playlists");
  const [openPlaylist, setOpenPlaylist] = useState<string | null>(null);
  const [openAlbum, setOpenAlbum] = useState<string | null>(null);
  const offline = useOfflineTracks();
  const { playList } = usePlayer();

  const { playlists, rest } = useMemo(() => groupByPlaylist(offline), [offline]);
  const { albums, loose } = useMemo(() => groupByAlbum(rest), [rest]);
  const activePlaylist = openPlaylist
    ? playlists.find((p) => p.id === openPlaylist) ?? null
    : null;
  const activeAlbum = openAlbum
    ? albums.find((a) => a.album === openAlbum) ?? null
    : null;

  const { activeIndex, listRef } = useListKeyboard(
    tab === "songs" && !activeAlbum && !activePlaylist ? loose.length : 0,
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

  if (activePlaylist) {
    return (
      <GroupDetail
        title={activePlaylist.name}
        thumbnail={activePlaylist.thumbnail}
        tracks={activePlaylist.tracks}
        meta={[
          `${activePlaylist.tracks.length} pistas`,
          humanSize(offlineTotalSize(activePlaylist.tracks)),
        ].join(" · ")}
        onBack={() => setOpenPlaylist(null)}
      />
    );
  }

  if (activeAlbum) {
    return (
      <GroupDetail
        title={activeAlbum.album}
        thumbnail={activeAlbum.thumbnail}
        tracks={activeAlbum.tracks}
        meta={[
          `${activeAlbum.tracks.length} pistas`,
          humanSize(offlineTotalSize(activeAlbum.tracks)),
        ].join(" · ")}
        onBack={() => setOpenAlbum(null)}
      />
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
          className={tab === "playlists" ? "is-on" : ""}
          onClick={() => setTab("playlists")}
        >
          Playlists{playlists.length > 0 ? ` (${playlists.length})` : ""}
        </button>
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

      {tab === "playlists" &&
        (playlists.length === 0 ? (
          <div className="empty">
            <p>No tienes playlists completas descargadas.</p>
            <p className="empty__sub">
              Descarga una playlist entera desde su página para que aparezca
              aquí.
            </p>
          </div>
        ) : (
          <div className="albumgrid">
            {playlists.map((p) => (
              <button
                key={p.id}
                className="albumcard"
                onClick={() => setOpenPlaylist(p.id)}
              >
                <span className="albumcard__art">
                  {p.thumbnail ? (
                    <img src={p.thumbnail} alt="" loading="lazy" />
                  ) : (
                    <Icon name="list" size={22} />
                  )}
                </span>
                <span className="albumcard__title">{p.name}</span>
                <span className="albumcard__meta">
                  {p.tracks.length} canción{p.tracks.length === 1 ? "" : "es"}
                </span>
              </button>
            ))}
          </div>
        ))}

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
              Las canciones que descargues fuera de un álbum o playlist
              aparecen aquí.
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
