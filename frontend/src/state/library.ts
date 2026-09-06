import { useSyncExternalStore } from "react";

import { addFavorite, getFavorites, removeFavorite } from "../api";
import type { Track } from "../types";

// Server-owned favorites (per user). Mirrors the playlists.ts store: a stable
// module-level snapshot + a Set of listeners, seeded lazily from the API on the
// first useLibrary() read. First paint is [] and then fills in — the same flash
// behaviour playlists.ts already has, and accepted by design D13.

let snapshot: Track[] = [];
let initialized = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

async function ensureInit() {
  if (initialized) return;
  initialized = true;
  try {
    snapshot = await getFavorites();
    emit();
  } catch {
    // Let the next mount retry (e.g. a 401 that just bounced us to the gate).
    initialized = false;
  }
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export function useLibrary(): Track[] {
  ensureInit();
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot,
  );
}

/**
 * Optimistic toggle: reassign + emit immediately, then reconcile with the
 * server. On rejection, restore the exact previous array and emit again.
 */
export async function toggleLibrary(track: Track) {
  const previous = snapshot;
  const exists = previous.some((t) => t.id === track.id);
  snapshot = exists
    ? previous.filter((t) => t.id !== track.id)
    : [track, ...previous];
  emit();

  try {
    if (exists) await removeFavorite(track.id);
    else await addFavorite(track);
  } catch {
    snapshot = previous;
    emit();
  }
}

export function isSaved(id: string, library: Track[]): boolean {
  return library.some((t) => t.id === id);
}

/** Clear the store and allow a fresh seed on the next mount (logout / 401). */
export function resetLibrary() {
  snapshot = [];
  initialized = false;
  emit();
}

// Uniform name for the state/reset.ts aggregator.
export { resetLibrary as reset };
