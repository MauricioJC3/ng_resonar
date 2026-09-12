import { type DragEvent, useState } from "react";

import type { VideoItem } from "../types";
import { isSaved, toggleLibrary, useLibrary } from "../state/library";
import { offlineTotalSize, useOfflineTracks } from "../state/offline";
import { useSavedVideos } from "../state/savedVideos";
import { usePlayer } from "../state/player";
import { hasTrackDrag, readTrackDrag } from "../lib/dnd";
import { useListKeyboard } from "../lib/useListKeyboard";
import Icon from "./Icon";
import TrackRow from "./TrackRow";
import SavedVideoRow from "./SavedVideoRow";

function humanSize(bytes: number): string {
  const mb = bytes / 1_048_576;
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;
}

export default function LibraryView({
  onWatch,
}: {
  onWatch: (v: VideoItem) => void;
}) {
  const [tab, setTab] = useState<"songs" | "videos" | "offline">("songs");
  const [dropActive, setDropActive] = useState(false);
  const songs = useLibrary();
  const videos = useSavedVideos();
  const offline = useOfflineTracks();
  const { playList } = usePlayer();

  const { activeIndex, listRef } = useListKeyboard(
    tab === "songs" ? songs.length : 0,
    (i) => playList(songs, i),
  );

  const dropProps =
    tab === "songs"
      ? {
          onDragOver: (e: DragEvent) => {
            if (!hasTrackDrag(e)) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy" as const;
            setDropActive(true);
          },
          onDragLeave: () => setDropActive(false),
          onDrop: (e: DragEvent) => {
            e.preventDefault();
            setDropActive(false);
            const track = readTrackDrag(e);
            if (track && !isSaved(track.id, songs)) toggleLibrary(track);
          },
        }
      : {};

  return (
    <div
      className={"view" + (dropActive ? " view--drop" : "")}
      {...dropProps}
    >
      <h1 className="view__title">Biblioteca</h1>

      <div className="segmented">
        <button
          className={tab === "songs" ? "is-on" : ""}
          onClick={() => setTab("songs")}
        >
          Canciones{songs.length > 0 ? ` (${songs.length})` : ""}
        </button>
        <button
          className={tab === "videos" ? "is-on" : ""}
          onClick={() => setTab("videos")}
        >
          Videos{videos.length > 0 ? ` (${videos.length})` : ""}
        </button>
        <button
          className={tab === "offline" ? "is-on" : ""}
          onClick={() => setTab("offline")}
        >
          Sin conexión{offline.length > 0 ? ` (${offline.length})` : ""}
        </button>
      </div>

      {tab === "songs" &&
        (songs.length === 0 ? (
          <div className="empty">
            <p>Sin canciones guardadas.</p>
            <p className="empty__sub">
              Marca canciones con ♥ desde la búsqueda.
            </p>
          </div>
        ) : (
          <div className="tracklist" ref={listRef}>
            {songs.map((track, i) => (
              <TrackRow
                key={track.id}
                track={track}
                index={i}
                selected={i === activeIndex}
                onPlay={() => playList(songs, i)}
              />
            ))}
          </div>
        ))}

      {tab === "videos" &&
        (videos.length === 0 ? (
          <div className="empty">
            <p>Sin videos guardados.</p>
            <p className="empty__sub">
              Abre un video y pulsa «Guardar en HD» para tenerlo aquí.
            </p>
          </div>
        ) : (
          <div className="srows">
            {videos.map((entry) => (
              <SavedVideoRow key={entry.id} entry={entry} onWatch={onWatch} />
            ))}
          </div>
        ))}

      {tab === "offline" &&
        (offline.length === 0 ? (
          <div className="empty">
            <p>Nada descargado para escuchar sin conexión.</p>
            <p className="empty__sub">
              Pulsa <Icon name="offline" size={13} /> en una canción, álbum o
              playlist para tenerla disponible sin internet.
            </p>
          </div>
        ) : (
          <>
            <p className="hint">
              {offline.filter((t) => t.status === "ready").length} canción
              {offline.filter((t) => t.status === "ready").length === 1
                ? ""
                : "es"}{" "}
              · {humanSize(offlineTotalSize(offline))}
            </p>
            <div className="tracklist">
              {offline.map((track, i) => (
                <TrackRow
                  key={track.id}
                  track={track}
                  index={i}
                  onPlay={() => playList(offline, i)}
                />
              ))}
            </div>
          </>
        ))}
    </div>
  );
}
