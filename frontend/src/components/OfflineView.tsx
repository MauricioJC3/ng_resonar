import { useMemo, useState } from "react";

import { offlineTotalSize, useOfflineTracks } from "../state/offline";
import type { OfflineAlbumRef, OfflinePlaylistRef, OfflineTrack } from "../state/offline";
import { usePlayer } from "../state/player";
import { useListKeyboard } from "../lib/useListKeyboard";
import { shuffled } from "../lib/shuffle";
import Icon from "./Icon";
import TrackRow from "./TrackRow";

function humanSize(bytes: number): string {
  const mb = bytes / 1_048_576;
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;
}

interface Group {
  id: string;
  name: string;
  thumbnail: string | null;
  tracks: OfflineTrack[];
}

function groupByRef(
  tracks: OfflineTrack[],
  refsOf: (t: OfflineTrack) => (OfflinePlaylistRef | OfflineAlbumRef)[] | undefined,
): { groups: Group[]; rest: OfflineTrack[] } {
  const byId = new Map<string, Group>();
  const rest: OfflineTrack[] = [];
  for (const t of tracks) {
    const refs = refsOf(t);
    if (!refs?.length) {
      rest.push(t);
      continue;
    }
    for (const ref of refs) {
      const group = byId.get(ref.id) ?? {
        id: ref.id,
        name: ref.name,
        thumbnail: null,
        tracks: [],
      };
      group.tracks.push(t);
      if (!group.thumbnail && t.thumbnail) group.thumbnail = t.thumbnail;
      byId.set(ref.id, group);
    }
  }
  return { groups: [...byId.values()], rest };
}

/**
 * Tracks downloaded via a playlist's "Sin conexión" button carry that
 * playlist's id/name (see `state/offline.ts`) — pull those out first so a
 * playlist's songs stay together in "Sin conexión" regardless of which
 * album each one originally belongs to. A track downloaded from more than
 * one playlist shows up under each. Whatever's left falls through to
 * `groupByAlbum`.
 */
export function groupByPlaylist(
  tracks: OfflineTrack[],
): { playlists: Group[]; rest: OfflineTrack[] } {
  const { groups, rest } = groupByRef(tracks, (t) => t.playlists);
  return { playlists: groups, rest };
}

/**
 * Tracks downloaded via an album's own "Sin conexión" button carry that
 * album's id/name — deliberately *not* just the track's own `album` field,
 * so downloading one song from search/the player (which still carries that
 * song's album metadata) doesn't get mistaken for "the whole album was
 * downloaded" and land in "Álbumes" instead of "Canciones". Everything left
 * without an album tag (singles, one-off downloads) is `loose`.
 */
export function groupByAlbum(
  tracks: OfflineTrack[],
): { albums: Group[]; loose: OfflineTrack[] } {
  const { groups, rest } = groupByRef(tracks, (t) => t.albums);
  return { albums: groups, loose: rest };
}

/** Shared "open group" screen for a playlist or album inside Sin conexión. */
function GroupDetail({
  group,
  onBack,
}: {
  group: Group;
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
          {group.thumbnail ? (
            <img src={group.thumbnail} alt="" />
          ) : (
            <Icon name="list" size={30} />
          )}
        </div>
        <div className="pldetail__meta">
          <h1>{group.name}</h1>
          <p>
            {[
              `${group.tracks.length} pistas`,
              humanSize(offlineTotalSize(group.tracks)),
            ].join(" · ")}
          </p>
          <div className="pldetail__actions">
            <button
              className="btn btn--accent"
              onClick={() => playList(group.tracks, 0)}
            >
              <Icon name="play" size={14} filled /> Reproducir
            </button>
            <button
              className="btn"
              onClick={() => playList(shuffled(group.tracks), 0)}
            >
              <Icon name="shuffle" size={14} /> Aleatorio
            </button>
          </div>
        </div>
      </div>

      <div className="tracklist">
        {group.tracks.map((track, i) => (
          <TrackRow
            key={track.id}
            track={track}
            index={i}
            onPlay={() => playList(group.tracks, i)}
          />
        ))}
      </div>
    </div>
  );
}

/** Shared grid of group cards for the Playlists / Álbumes tabs. */
function GroupGrid({
  groups,
  emptyTitle,
  emptySub,
  onOpen,
}: {
  groups: Group[];
  emptyTitle: string;
  emptySub: string;
  onOpen: (id: string) => void;
}) {
  if (groups.length === 0) {
    return (
      <div className="empty">
        <p>{emptyTitle}</p>
        <p className="empty__sub">{emptySub}</p>
      </div>
    );
  }
  return (
    <div className="albumgrid">
      {groups.map((g) => (
        <button key={g.id} className="albumcard" onClick={() => onOpen(g.id)}>
          <span className="albumcard__art">
            {g.thumbnail ? (
              <img src={g.thumbnail} alt="" loading="lazy" />
            ) : (
              <Icon name="list" size={22} />
            )}
          </span>
          <span className="albumcard__title">{g.name}</span>
          <span className="albumcard__meta">
            {g.tracks.length} canción{g.tracks.length === 1 ? "" : "es"}
          </span>
        </button>
      ))}
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
    ? albums.find((a) => a.id === openAlbum) ?? null
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
    return <GroupDetail group={activePlaylist} onBack={() => setOpenPlaylist(null)} />;
  }

  if (activeAlbum) {
    return <GroupDetail group={activeAlbum} onBack={() => setOpenAlbum(null)} />;
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

      {tab === "playlists" && (
        <GroupGrid
          groups={playlists}
          emptyTitle="No tienes playlists completas descargadas."
          emptySub="Descarga una playlist entera desde su página para que aparezca aquí."
          onOpen={setOpenPlaylist}
        />
      )}

      {tab === "albums" && (
        <GroupGrid
          groups={albums}
          emptyTitle="No tienes álbumes completos descargados."
          emptySub="Descarga un álbum entero desde su página para que aparezca aquí."
          onOpen={setOpenAlbum}
        />
      )}

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
