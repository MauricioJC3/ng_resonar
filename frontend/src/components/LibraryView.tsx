import { useState } from "react";

import type { VideoItem } from "../types";
import { useLibrary } from "../state/library";
import { useSavedVideos } from "../state/savedVideos";
import { usePlayer } from "../state/player";
import TrackRow from "./TrackRow";
import SavedVideoRow from "./SavedVideoRow";

export default function LibraryView({
  onWatch,
}: {
  onWatch: (v: VideoItem) => void;
}) {
  const [tab, setTab] = useState<"songs" | "videos">("songs");
  const songs = useLibrary();
  const videos = useSavedVideos();
  const { playList } = usePlayer();

  return (
    <div className="view">
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
          <div className="tracklist">
            {songs.map((track, i) => (
              <TrackRow
                key={track.id}
                track={track}
                index={i}
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
    </div>
  );
}
