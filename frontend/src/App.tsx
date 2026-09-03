import { useCallback, useState } from "react";

import Sidebar from "./components/Sidebar";
import SearchView from "./components/SearchView";
import VideosView from "./components/VideosView";
import PlaylistsView from "./components/PlaylistsView";
import PlaylistDetailView from "./components/PlaylistDetailView";
import LibraryView from "./components/LibraryView";
import SettingsView from "./components/SettingsView";
import WatchView from "./components/WatchView";
import PlayerBar from "./components/PlayerBar";
import { PlayerProvider } from "./state/player";
import type { VideoItem } from "./types";

export type View = "search" | "videos" | "playlists" | "library" | "settings";

export default function App() {
  const [view, setView] = useState<View>("search");
  const [watching, setWatching] = useState<VideoItem | null>(null);
  const [openPlaylist, setOpenPlaylist] = useState<string | null>(null);

  const watch = useCallback((v: VideoItem) => setWatching(v), []);

  function navigate(v: View) {
    setWatching(null);
    setOpenPlaylist(null);
    setView(v);
  }

  let content;
  if (watching) {
    content = (
      <WatchView
        video={watching}
        onClose={() => setWatching(null)}
        onWatch={watch}
      />
    );
  } else if (view === "playlists" && openPlaylist) {
    content = (
      <PlaylistDetailView
        id={openPlaylist}
        onBack={() => setOpenPlaylist(null)}
      />
    );
  } else if (view === "search") {
    content = <SearchView />;
  } else if (view === "videos") {
    content = <VideosView onWatch={watch} />;
  } else if (view === "playlists") {
    content = <PlaylistsView onOpen={setOpenPlaylist} />;
  } else if (view === "settings") {
    content = <SettingsView />;
  } else {
    content = <LibraryView onWatch={watch} />;
  }

  return (
    <PlayerProvider>
      <div className="app">
        <Sidebar view={view} onNavigate={navigate} />
        <main className="main">{content}</main>
        <PlayerBar />
      </div>
    </PlayerProvider>
  );
}
