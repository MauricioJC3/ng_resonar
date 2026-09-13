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

export interface OfflineAlbumRef {
  id: string;
  name: string;
}

export interface OfflineTrack extends Track {
  status: "downloading" | "ready" | "error";
  size?: number;
  downloadedAt?: number;
  /**
   * Playlist(s) / album(s) this track was pulled offline *from* — as in,
   * the user hit "Sin conexión" on that playlist/album page, not just that
   * the song happens to carry that metadata. This is what "Sin conexión"
   * groups by, deliberately independent of the track's own `album` field:
   * downloading one song from search/the player only ever sets `status`,
   * so it lands in "Canciones" regardless of what album it came from on
   * YouTube Music — only downloading the whole album from its own page
   * tags it into "Álbumes".
   */
  playlists?: OfflinePlaylistRef[];
  albums?: OfflineAlbumRef[];
}

interface OfflineSource {
  playlist?: OfflinePlaylistRef;
  album?: OfflineAlbumRef;
}

function mergeRef<T extends { id: string }>(
  existing: T[] | undefined,
  add: T | undefined,
): T[] | undefined {
  if (!add) return existing;
  if (existing?.some((r) => r.id === add.id)) return existing;
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
 * connection. When `source` names the playlist/album it's coming from (its
 * "Sin conexión" button), the track is tagged with it — even if the track
 * was already offline from somewhere else — so it still shows up grouped
 * under that playlist/album.
 */
export async function downloadOffline(
  track: Track,
  source?: OfflineSource,
): Promise<void> {
  const existing = snapshot.find((t) => t.id === track.id);
  if (existing && existing.status !== "error") {
    const playlists = mergeRef(existing.playlists, source?.playlist);
    const albums = mergeRef(existing.albums, source?.album);
    if (playlists !== existing.playlists || albums !== existing.albums) {
      const updated = { ...existing, playlists, albums };
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

  const playlists = mergeRef(existing?.playlists, source?.playlist);
  const albums = mergeRef(existing?.albums, source?.album);
  snapshot = [
    { ...track, status: "downloading", playlists, albums },
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
      albums,
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
  source?: OfflineSource,
): Promise<void> {
  return (async () => {
    for (const t of tracks) {
      await downloadOffline(t, source);
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
