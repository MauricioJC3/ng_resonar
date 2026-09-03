import { useSyncExternalStore } from "react";

import type { Track } from "../types";

const KEY = "resonar:library";

function readStore(): Track[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Track[]) : [];
  } catch {
    return [];
  }
}

// useSyncExternalStore requires a stable snapshot reference between renders,
// so we keep a cached array and only replace it when something actually changes.
let snapshot: Track[] = readStore();
const listeners = new Set<() => void>();

function emit() {
  snapshot = readStore();
  listeners.forEach((l) => l());
}

export function toggleLibrary(track: Track) {
  const current = readStore();
  const exists = current.some((t) => t.id === track.id);
  const next = exists
    ? current.filter((t) => t.id !== track.id)
    : [track, ...current];
  localStorage.setItem(KEY, JSON.stringify(next));
  emit();
}

export function useLibrary(): Track[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => snapshot,
    () => snapshot,
  );
}

export function isSaved(id: string, library: Track[]): boolean {
  return library.some((t) => t.id === id);
}
