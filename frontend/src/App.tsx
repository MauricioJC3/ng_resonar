import { useCallback, useEffect, useState } from "react";
import { flushSync } from "react-dom";

import Nav from "./components/Nav";
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

interface NavState {
  view: View;
  watching: VideoItem | null;
  openPlaylist: string | null;
}

const DEFAULT_STATE: NavState = {
  view: "search",
  watching: null,
  openPlaylist: null,
};

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export default function App() {
  const [view, setView] = useState<View>(DEFAULT_STATE.view);
  const [watching, setWatching] = useState<VideoItem | null>(
    DEFAULT_STATE.watching,
  );
  const [openPlaylist, setOpenPlaylist] = useState<string | null>(
    DEFAULT_STATE.openPlaylist,
  );

  // Apply a resolved navigation state to the three setters. No history writes.
  const applyState = useCallback((s: NavState) => {
    setView(s.view);
    setWatching(s.watching);
    setOpenPlaylist(s.openPlaylist);
  }, []);

  // Single funnel for every view/overlay transition: push history, then swap
  // the content — wrapped in a View Transition when the engine supports it.
  const go = useCallback(
    (next: NavState) => {
      history.pushState({ ...next, np: false }, "");
      if (
        typeof document.startViewTransition === "function" &&
        !prefersReducedMotion()
      ) {
        document.startViewTransition(() => flushSync(() => applyState(next)));
      } else {
        applyState(next);
      }
    },
    [applyState],
  );

  // First Back needs a target: stamp the current state onto the entry (mount only).
  useEffect(() => {
    history.replaceState({ ...DEFAULT_STATE, np: false }, "");
  }, []);

  // Back/forward gesture: restore state from the history entry (never re-push).
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const s = (e.state ?? null) as Partial<NavState> | null;
      applyState({
        view: (s?.view as View) ?? DEFAULT_STATE.view,
        watching: (s?.watching as VideoItem | null) ?? DEFAULT_STATE.watching,
        openPlaylist: s?.openPlaylist ?? DEFAULT_STATE.openPlaylist,
      });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [applyState]);

  const navigate = useCallback(
    (v: View) => go({ view: v, watching: null, openPlaylist: null }),
    [go],
  );

  const watch = useCallback(
    (v: VideoItem) => go({ view, watching: v, openPlaylist: null }),
    [go, view],
  );

  const openPlaylistDetail = useCallback(
    (id: string) =>
      go({ view: "playlists", watching: null, openPlaylist: id }),
    [go],
  );

  // Overlays close by walking history back so the Back gesture stays consistent.
  const back = useCallback(() => history.back(), []);

  let content;
  if (watching) {
    content = (
      <WatchView video={watching} onClose={back} onWatch={watch} />
    );
  } else if (view === "playlists" && openPlaylist) {
    content = <PlaylistDetailView id={openPlaylist} onBack={back} />;
  } else if (view === "search") {
    content = <SearchView />;
  } else if (view === "videos") {
    content = <VideosView onWatch={watch} />;
  } else if (view === "playlists") {
    content = <PlaylistsView onOpen={openPlaylistDetail} />;
  } else if (view === "settings") {
    content = <SettingsView />;
  } else {
    content = <LibraryView onWatch={watch} />;
  }

  return (
    <PlayerProvider>
      <div className="app">
        <Nav view={view} onNavigate={navigate} />
        <main className="main">{content}</main>
        <PlayerBar />
      </div>
    </PlayerProvider>
  );
}
