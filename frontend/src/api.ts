import type {
  AppSettings,
  BatchStatus,
  DownloadFormat,
  HistoryEntry,
  Lyrics,
  Playlist,
  PlaylistSummary,
  SavedVideo,
  Track,
  VideoItem,
} from "./types";

const BASE = "/api";

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`${res.status} ${detail}`.trim());
  }
  return res.json() as Promise<T>;
}

export function search(q: string, type = "songs"): Promise<Track[]> {
  return getJSON<{ results: Track[] }>(
    `/search?q=${encodeURIComponent(q)}&type=${type}`,
  ).then((r) => r.results);
}

export function suggest(q: string): Promise<string[]> {
  return getJSON<{ suggestions: string[] }>(`/suggest?q=${encodeURIComponent(q)}`)
    .then((r) => r.suggestions ?? [])
    .catch(() => []);
}

export function related(id: string): Promise<Track[]> {
  return getJSON<{ results: Track[] }>(`/related/${id}`)
    .then((r) => r.results)
    .catch(() => []);
}

export function searchVideos(q: string): Promise<VideoItem[]> {
  return getJSON<{ results: VideoItem[] }>(
    `/videos/search?q=${encodeURIComponent(q)}`,
  ).then((r) => r.results);
}

export function homeMusic(): Promise<Track[]> {
  return getJSON<{ results: Track[] }>(`/home`)
    .then((r) => r.results)
    .catch(() => []);
}

export function trendingVideos(): Promise<VideoItem[]> {
  return getJSON<{ results: VideoItem[] }>(`/videos/trending`)
    .then((r) => r.results)
    .catch(() => []);
}

export function videoInfo(id: string): Promise<VideoItem> {
  return getJSON<VideoItem>(`/videos/info/${id}`);
}

export function listSavedVideos(): Promise<SavedVideo[]> {
  return getJSON<{ results: SavedVideo[] }>(`/library/videos`)
    .then((r) => r.results)
    .catch(() => []);
}

export async function apiSaveVideo(
  id: string,
  quality = 1080,
  force = false,
): Promise<{ status: string }> {
  const res = await fetch(
    `${BASE}/library/videos/${id}?quality=${quality}&force=${force}`,
    { method: "POST" },
  );
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export async function apiDeleteSavedVideo(id: string): Promise<void> {
  await fetch(`${BASE}/library/videos/${id}`, { method: "DELETE" });
}

export const streamUrl = (id: string) => `${BASE}/stream/${id}`;
export const videoStreamUrl = (id: string) => `${BASE}/videos/stream/${id}`;
export const savedVideoFileUrl = (id: string) => `${BASE}/library/videos/${id}/file`;
export const savedVideoDownloadUrl = (id: string) =>
  `${BASE}/library/videos/${id}/download`;

export const downloadUrl = (id: string, format: DownloadFormat = "mp3") =>
  `${BASE}/download/${id}?format=${format}`;

// ---- Lyrics ----

export function getLyrics(
  artist: string,
  title: string,
  album = "",
  duration = 0,
): Promise<Lyrics> {
  const q = new URLSearchParams({
    artist,
    title,
    album,
    duration: String(duration || 0),
  });
  return getJSON<Lyrics>(`/lyrics?${q}`).catch(() => ({
    synced: [],
    plain: null,
    source: null,
  }));
}

// ---- Playlists ----

async function send<T>(path: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`${res.status} ${detail}`.trim());
  }
  return res.json() as Promise<T>;
}

export function listPlaylists(): Promise<PlaylistSummary[]> {
  return getJSON<{ results: PlaylistSummary[] }>(`/playlists`).then(
    (r) => r.results,
  );
}

export const getPlaylist = (id: string) => getJSON<Playlist>(`/playlists/${id}`);

export const createPlaylistApi = (name: string, fromUrl?: string) =>
  send<Playlist>(`/playlists`, "POST", { name, fromUrl });

export const renamePlaylistApi = (id: string, name: string) =>
  send<Playlist>(`/playlists/${id}`, "PATCH", { name });

export const deletePlaylistApi = (id: string) =>
  fetch(`${BASE}/playlists/${id}`, { method: "DELETE" }).then(() => undefined);

export const addTracksApi = (id: string, tracks: Track[]) =>
  send<Playlist>(`/playlists/${id}/tracks`, "POST", { tracks });

export const removeTrackApi = (id: string, trackId: string) =>
  send<Playlist>(`/playlists/${id}/tracks/${trackId}`, "DELETE");

export const reorderPlaylistApi = (id: string, ids: string[]) =>
  send<Playlist>(`/playlists/${id}/tracks`, "PUT", { ids });

// ---- Batch download ----

export const startBatchApi = (ids: string[], name: string, format = "mp3") =>
  send<{ jobId: string }>(`/download/batch`, "POST", { ids, name, format });

export const batchStatusApi = (jobId: string) =>
  getJSON<BatchStatus>(`/download/batch/${jobId}`);

export const batchFileUrl = (jobId: string) =>
  `${BASE}/download/batch/${jobId}/file`;

// ---- Settings / scrobbling ----

export const getSettings = () => getJSON<AppSettings>(`/settings`);

export const putSettings = (patch: unknown) =>
  send<AppSettings>(`/settings`, "PUT", patch);

export const lastfmAuthUrl = (callback: string) =>
  getJSON<{ url: string }>(
    `/scrobble/lastfm/auth-url?callback=${encodeURIComponent(callback)}`,
  );

export function scrobbleNowPlaying(track: Track): void {
  void fetch(`${BASE}/scrobble/now-playing`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ track }),
  }).catch(() => {});
}

export function scrobbleSubmit(track: Track): void {
  void fetch(`${BASE}/scrobble/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ track }),
  }).catch(() => {});
}

// ---- Playback history ----

export function recordPlay(
  item: Track | VideoItem,
  kind: "song" | "video",
  source?: string,
): void {
  const body =
    kind === "song"
      ? {
          videoId: (item as Track).id,
          title: item.title,
          artist: (item as Track).artists?.[0],
          thumbnail: item.thumbnail,
          kind,
          source,
        }
      : {
          videoId: (item as VideoItem).id,
          title: item.title,
          artist: (item as VideoItem).uploader,
          thumbnail: item.thumbnail,
          kind,
          source,
        };
  void fetch(`${BASE}/history`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});
}

export function getHistory(limit = 20): Promise<HistoryEntry[]> {
  return getJSON<{ results: HistoryEntry[] }>(`/history?limit=${limit}`)
    .then((r) => r.results)
    .catch(() => []);
}

export function clearHistory(): Promise<void> {
  return fetch(`${BASE}/history`, { method: "DELETE" })
    .then(() => undefined)
    .catch(() => undefined);
}

// ---- Recommendations ----

export function recommendations(limit = 30): Promise<Track[]> {
  return getJSON<{ results: Track[] }>(`/recommendations?limit=${limit}`)
    .then((r) => r.results)
    .catch(() => []);
}
