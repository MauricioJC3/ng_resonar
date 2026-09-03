// Coordinates the music player and the video player so only one plays at a time,
// and lets the music keyboard shortcuts step aside while a video is on screen.

type Kind = "music" | "video";

const listeners = new Set<(active: Kind) => void>();

let videoActive = false;

export function claimPlayback(kind: Kind) {
  listeners.forEach((l) => l(kind));
}

export function onPlaybackClaim(cb: (active: Kind) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function setVideoActive(v: boolean) {
  videoActive = v;
}

export function isVideoActive() {
  return videoActive;
}
