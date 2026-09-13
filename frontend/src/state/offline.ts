import { useSyncExternalStore } from "react";

import { streamUrl } from "../api";
import type { Track } from "../types";

// Client-side "listen without a connection" store: the actual audio bytes go
// into IndexedDB (a separate object store from the metadata, so listing
// downloads never has to touch the blobs), entirely on-device. This is
// independent of the server-side "saved video" library and of the plain MP3
// export button — both of those still require a live connection.
//
// Deliberately NOT wired into state/reset.ts: these are real downloaded
// bytes the user paid bandwidth for, tied to the device rather than the
// login session, so a transient 401 (or even a real logout) must not wipe
// them — that would be surprising and expensive to redo.

export interface OfflinePlaylistRef {
  id: string;
  name: string;
}

export interface OfflineTrack extends Track {
  status: "downloading" | "ready" | "error";
  size?: number;
  downloadedAt?: number;
  /**
   * Playlist(s) this track was pulled offline from — lets "Sin conexión"
   * keep a playlist's tracks together regardless of each song's own album,
   * since that's how the user actually grouped and downloaded them.
   */
  playlists?: OfflinePlaylistRef[];
}

function mergePlaylistRef(
  existing: OfflinePlaylistRef[] | undefined,
  add: OfflinePlaylistRef | undefined,
): OfflinePlaylistRef[] | undefined {
  if (!add) return existing;
  if (existing?.some((p) => p.id === add.id)) return existing;
  return [...(existing ?? []), add];
}

const DB_NAME = "resonar-offline";
const DB_VERSION = 1;
const META = "tracks";
const BLOBS = "blobs";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(META)) {
          db.createObjectStore(META, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(BLOBS)) {
          db.createObjectStore(BLOBS);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function idbGetAllMeta(): Promise<OfflineTrack[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META, "readonly");
    const req = tx.objectStore(META).getAll();
    req.onsuccess = () => resolve(req.result as OfflineTrack[]);
    req.onerror = () => reject(req.error);
  });
}

async function idbGetBlob(id: string): Promise<Blob | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BLOBS, "readonly");
    const req = tx.objectStore(BLOBS).get(id);
    req.onsuccess = () => resolve(req.result as Blob | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function idbPutMeta(entry: OfflineTrack): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(META, "readwrite");
  tx.objectStore(META).put(entry);
  await txDone(tx);
}

async function idbPutBlob(id: string, blob: Blob): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(BLOBS, "readwrite");
  tx.objectStore(BLOBS).put(blob, id);
  await txDone(tx);
}

async function idbDelete(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction([META, BLOBS], "readwrite");
  tx.objectStore(META).delete(id);
  tx.objectStore(BLOBS).delete(id);
  await txDone(tx);
}

// ---- Reactive snapshot (same shape as state/savedVideos.ts) ----

let snapshot: OfflineTrack[] = [];
let initialized = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

async function ensureInit() {
  if (initialized) return;
  initialized = true;
  try {
    const rows = await idbGetAllMeta();
    snapshot = rows.sort((a, b) => (b.downloadedAt ?? 0) - (a.downloadedAt ?? 0));
    emit();
  } catch {
    // IndexedDB unavailable (private mode, disabled storage, …) — offline
    // downloads just won't be offered; everything else keeps working.
    initialized = false;
  }
}

export function useOfflineTracks(): OfflineTrack[] {
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

export function isOffline(id: string, items: OfflineTrack[]): boolean {
  return items.some((t) => t.id === id && t.status === "ready");
}

export function offlineStatus(
  id: string,
  items: OfflineTrack[],
): OfflineTrack["status"] | undefined {
  return items.find((t) => t.id === id)?.status;
}

export function offlineTotalSize(items: OfflineTrack[]): number {
  return items.reduce((sum, t) => sum + (t.size ?? 0), 0);
}

/**
 * Download one track's audio into IndexedDB so it plays without a
 * connection. When `playlist` is given (downloading from a playlist's "Sin
 * conexión" button), the track is tagged with it — even if the track was
 * already offline from somewhere else — so it still shows up grouped under
 * that playlist.
 */
export async function downloadOffline(
  track: Track,
  playlist?: OfflinePlaylistRef,
): Promise<void> {
  const existing = snapshot.find((t) => t.id === track.id);
  if (existing && existing.status !== "error") {
    const playlists = mergePlaylistRef(existing.playlists, playlist);
    if (playlists !== existing.playlists) {
      const updated = { ...existing, playlists };
      snapshot = snapshot.map((t) => (t.id === track.id ? updated : t));
      emit();
      try {
        await idbPutMeta(updated);
      } catch {
        /* ignore */
      }
    }
    return;
  }

  const playlists = mergePlaylistRef(existing?.playlists, playlist);
  snapshot = [
    { ...track, status: "downloading", playlists },
    ...snapshot.filter((t) => t.id !== track.id),
  ];
  emit();

  try {
    const res = await fetch(streamUrl(track.id), { credentials: "include" });
    if (!res.ok) throw new Error(`stream ${res.status}`);
    const blob = await res.blob();
    const entry: OfflineTrack = {
      ...track,
      status: "ready",
      size: blob.size,
      downloadedAt: Date.now(),
      playlists,
    };
    await idbPutBlob(track.id, blob);
    await idbPutMeta(entry);
    snapshot = [entry, ...snapshot.filter((t) => t.id !== track.id)];
    emit();
  } catch {
    snapshot = snapshot.map((t) =>
      t.id === track.id ? { ...t, status: "error" } : t,
    );
    emit();
  }
}

/**
 * Download every track not already offline, one at a time (album/playlist
 * "listen offline"). Callers fire-and-forget this — the reactive list is how
 * progress shows up — but the returned promise lets tests await it too.
 */
export function downloadManyOffline(
  tracks: Track[],
  playlist?: OfflinePlaylistRef,
): Promise<void> {
  return (async () => {
    for (const t of tracks) {
      await downloadOffline(t, playlist);
    }
  })();
}

export async function removeOffline(id: string): Promise<void> {
  snapshot = snapshot.filter((t) => t.id !== id);
  emit();
  try {
    await idbDelete(id);
  } catch {
    /* ignore */
  }
}

/** Returns the stored audio blob for a track, or null if it isn't downloaded. */
export async function getOfflineBlob(id: string): Promise<Blob | null> {
  try {
    return (await idbGetBlob(id)) ?? null;
  } catch {
    return null;
  }
}
