import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

import Nav from "./components/Nav";
import HomeView from "./components/HomeView";
import SearchView from "./components/SearchView";
import VideosView from "./components/VideosView";
import PlaylistsView from "./components/PlaylistsView";
import PlaylistDetailView from "./components/PlaylistDetailView";
import LibraryView from "./components/LibraryView";
import HistoryView from "./components/HistoryView";
import AlbumView from "./components/AlbumView";
import ArtistView from "./components/ArtistView";
import SettingsView from "./components/SettingsView";
import WatchView from "./components/WatchView";
import PlayerBar from "./components/PlayerBar";
import MiniVideo from "./components/MiniVideo";
import ScrollTop from "./components/ScrollTop";
import { PlayerProvider } from "./state/player";
import { VideoProvider } from "./state/video";
import { registerAppNav } from "./state/appNav";
import { requestSearch } from "./state/search";
import type { View } from "./App";
import type { AuthUser, VideoItem } from "./types";

interface NavState {
  view: View;
  watching: VideoItem | null;
  openPlaylist: string | null;
  openAlbum: string | null;
  openArtist: string | null;
}

const DEFAULT_STATE: NavState = {
  view: "home",
  watching: null,
  openPlaylist: null,
  openAlbum: null,
  openArtist: null,
};

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * The authenticated application shell — the pre-auth `App` component, verbatim,
 * plus an `onLogout` prop threaded to `Nav`. It only ever mounts under the
 * `authed` gate, so its history/popstate effects never run on the login screen.
 */
export default function AuthedApp({
  user,
  onLogout,
}: {
  user: AuthUser | null;
  onLogout: () => void;
}) {
  const [view, setView] = useState<View>(DEFAULT_STATE.view);
  const [watching, setWatching] = useState<VideoItem | null>(
    DEFAULT_STATE.watching,
  );
  const [openPlaylist, setOpenPlaylist] = useState<string | null>(
    DEFAULT_STATE.openPlaylist,
  );
  const [openAlbum, setOpenAlbum] = useState<string | null>(
    DEFAULT_STATE.openAlbum,
  );
  const [openArtist, setOpenArtist] = useState<string | null>(
    DEFAULT_STATE.openArtist,
  );

  const mainRef = useRef<HTMLElement>(null);

  // Apply a resolved navigation state to the setters. No history writes.
  const applyState = useCallback((s: NavState) => {
    setView(s.view);
    setWatching(s.watching);
    setOpenPlaylist(s.openPlaylist);
    setOpenAlbum(s.openAlbum);
    setOpenArtist(s.openArtist);
  }, []);

  // True while a View Transition started here is still running. A second
  // navigation landing on top of a live transition is what leaves the
  // `::view-transition` screenshot pseudo stuck over the page — the "pantalla
  // negra hay que recargar" bug — so while one is in flight we just swap the
  // content directly.
  const vtBusy = useRef(false);

  const swap = useCallback(
    (next: NavState) => {
      const canVT =
        typeof document.startViewTransition === "function" &&
        !prefersReducedMotion();

      if (!canVT || vtBusy.current) {
        applyState(next);
        return;
      }

      try {
        vtBusy.current = true;
        const vt = document.startViewTransition!(() =>
          flushSync(() => applyState(next)),
        );
        const clear = () => {
          vtBusy.current = false;
        };
        // Never let either promise reject unhandled — a rejected transition
        // that nobody catches is the other way the overlay gets stuck.
        vt.updateCallbackDone.catch(clear);
        vt.finished.then(clear, clear);
      } catch {
        vtBusy.current = false;
        applyState(next);
      }
    },
    [applyState],
  );

  // Single funnel for every view/overlay transition: push history, then swap.
  const go = useCallback(
    (next: NavState) => {
      history.pushState({ ...next, np: false }, "");
      swap(next);
    },
    [swap],
  );

  // First Back needs a target: stamp the current state onto the entry (mount only).
  useEffect(() => {
    history.replaceState({ ...DEFAULT_STATE, np: false }, "");
  }, []);

  // Back/forward gesture: restore state from the history entry (never re-push,
  // never wrap in a View Transition — a pop mid-transition is exactly what
  // wedges the overlay).
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const s = (e.state ?? null) as Partial<NavState> | null;
      applyState({
        view: (s?.view as View) ?? DEFAULT_STATE.view,
        watching: (s?.watching as VideoItem | null) ?? DEFAULT_STATE.watching,
        openPlaylist: s?.openPlaylist ?? DEFAULT_STATE.openPlaylist,
        openAlbum: s?.openAlbum ?? DEFAULT_STATE.openAlbum,
        openArtist: s?.openArtist ?? DEFAULT_STATE.openArtist,
      });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [applyState]);

  const navigate = useCallback(
    (v: View) => go({ ...DEFAULT_STATE, view: v }),
    [go],
  );

  const watch = useCallback(
    (v: VideoItem) => go({ ...DEFAULT_STATE, view, watching: v }),
    [go, view],
  );

  const openPlaylistDetail = useCallback(
    (id: string) =>
      go({ ...DEFAULT_STATE, view: "playlists", openPlaylist: id }),
    [go],
  );

  const openAlbumDetail = useCallback(
    (id: string) => go({ ...DEFAULT_STATE, view: "search", openAlbum: id }),
    [go],
  );

  const openArtistDetail = useCallback(
    (id: string) => go({ ...DEFAULT_STATE, view: "search", openArtist: id }),
    [go],
  );

  const openSearchQuery = useCallback(
    (q: string) => {
      requestSearch(q);
      go({ ...DEFAULT_STATE, view: "search" });
    },
    [go],
  );

  // Let deep components (track rows, player bar, queue) jump to an artist.
  useEffect(
    () =>
      registerAppNav({
        openArtist: openArtistDetail,
        openSearch: openSearchQuery,
      }),
    [openArtistDetail, openSearchQuery],
  );

  // Overlays close by walking history back so the Back gesture stays consistent.
  const back = useCallback(() => history.back(), []);

  let content;
  if (watching) {
    content = <WatchView video={watching} onClose={back} onWatch={watch} />;
  } else if (openArtist) {
    content = (
      <ArtistView
        browseId={openArtist}
        onBack={back}
        onOpenAlbum={openAlbumDetail}
        onOpenPlaylist={openPlaylistDetail}
      />
    );
  } else if (openAlbum) {
    content = <AlbumView browseId={openAlbum} onBack={back} />;
  } else if (view === "playlists" && openPlaylist) {
    content = <PlaylistDetailView id={openPlaylist} onBack={back} />;
  } else if (view === "home") {
    content = <HomeView />;
  } else if (view === "search") {
    content = (
      <SearchView
        onOpenArtist={openArtistDetail}
        onOpenAlbum={openAlbumDetail}
        onOpenPlaylist={openPlaylistDetail}
      />
    );
  } else if (view === "videos") {
    content = <VideosView onWatch={watch} />;
  } else if (view === "playlists") {
    content = <PlaylistsView onOpen={openPlaylistDetail} />;
  } else if (view === "history") {
    content = <HistoryView onWatch={watch} />;
  } else if (view === "settings") {
    content = <SettingsView user={user} onLogout={onLogout} />;
  } else {
    content = <LibraryView onWatch={watch} />;
  }

  return (
    <PlayerProvider>
      <VideoProvider>
        <div className="app">
          <Nav view={view} onNavigate={navigate} onLogout={onLogout} />
          <main className="main" ref={mainRef}>
            {content}
          </main>
          <PlayerBar />
          <MiniVideo hidden={!!watching} onExpand={watch} />
          <ScrollTop scrollRef={mainRef} />
        </div>
      </VideoProvider>
    </PlayerProvider>
  );
}
