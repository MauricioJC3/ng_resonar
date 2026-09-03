import { useSyncExternalStore } from "react";

// Lightweight playback clock published by PlayerBar so panels (lyrics, etc.)
// can follow along without touching the <audio> element directly.

interface NowPlaying {
  time: number;
  duration: number;
  paused: boolean;
}

let state: NowPlaying = { time: 0, duration: 0, paused: true };
let seeker: ((t: number) => void) | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function setNowPlaying(patch: Partial<NowPlaying>) {
  const next = { ...state, ...patch };
  if (
    next.time !== state.time ||
    next.duration !== state.duration ||
    next.paused !== state.paused
  ) {
    state = next;
    emit();
  }
}

export function registerSeeker(fn: (t: number) => void) {
  seeker = fn;
}

export function seek(t: number) {
  seeker?.(t);
}

export function useNowPlaying(): NowPlaying {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state,
  );
}
