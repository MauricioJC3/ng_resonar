import { useSyncExternalStore } from "react";

import { apiDeleteSavedVideo, apiSaveVideo, listSavedVideos } from "../api";
import type { SavedVideo } from "../types";

// Single shared poller so WatchView and LibraryView stay in sync and we don't
// run one interval per mounted component.

let snapshot: SavedVideo[] = [];
let started = false;
let timer: number | undefined;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

async function poll() {
  let busy = false;
  try {
    const next = await listSavedVideos();
    busy = next.some((v) => v.status === "downloading");
    if (JSON.stringify(next) !== JSON.stringify(snapshot)) {
      snapshot = next;
      emit();
    }
  } catch {
    /* keep last snapshot */
  }
  timer = window.setTimeout(poll, busy ? 2500 : 20000);
}

function kick() {
  window.clearTimeout(timer);
  poll();
}

export function useSavedVideos(): SavedVideo[] {
  if (!started) {
    started = true;
    poll();
  }
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => snapshot,
    () => snapshot,
  );
}

export async function saveVideo(id: string, quality = 1080, force = false) {
  // optimistic placeholder so the UI reacts immediately
  if (!snapshot.some((v) => v.id === id) || force) {
    snapshot = [
      {
        id,
        title: null,
        thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        status: "downloading",
        progress: "en cola…",
      },
      ...snapshot.filter((v) => v.id !== id),
    ];
    emit();
  }
  await apiSaveVideo(id, quality, force);
  kick();
}

export async function removeSavedVideo(id: string) {
  await apiDeleteSavedVideo(id);
  snapshot = snapshot.filter((v) => v.id !== id);
  emit();
  kick();
}

export function savedEntry(
  id: string,
  items: SavedVideo[],
): SavedVideo | undefined {
  return items.find((v) => v.id === id);
}

/**
 * Stop the poller and clear the cached list (called on logout / 401).
 *
 * We must NOT re-kick `poll()` here: with no session the immediate
 * `GET /api/library/videos` 401s, which re-dispatches `resonar:session-expired`
 * and re-arms the 20s timer, so the login screen would fire a background 401
 * every ~20s. The poller re-arms naturally on the next `useSavedVideos()` mount
 * after re-login.
 */
export function resetSavedVideos() {
  window.clearTimeout(timer);
  started = false;
  snapshot = [];
  emit();
}

export { resetSavedVideos as reset };
