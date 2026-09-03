import { useSyncExternalStore } from "react";

import { getSettings, putSettings } from "../api";
import type { AppSettings } from "../types";

let snapshot: AppSettings | null = null;
let initialized = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export async function refreshSettings() {
  try {
    const next = await getSettings();
    if (JSON.stringify(next) !== JSON.stringify(snapshot)) {
      snapshot = next;
      emit();
    }
  } catch {
    /* keep last */
  }
}

function ensureInit() {
  if (initialized) return;
  initialized = true;
  refreshSettings();
}

export function useSettings(): AppSettings | null {
  ensureInit();
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => snapshot,
    () => snapshot,
  );
}

export async function saveSettings(patch: unknown) {
  await putSettings(patch);
  await refreshSettings();
}

/** Synchronous check used by the player to avoid needless scrobble requests. */
export function scrobblingOn(): boolean {
  const s = snapshot;
  if (!s) return false;
  return (
    (s.listenbrainz.enabled && s.listenbrainz.hasToken) ||
    (s.lastfm.enabled && s.lastfm.connected)
  );
}
