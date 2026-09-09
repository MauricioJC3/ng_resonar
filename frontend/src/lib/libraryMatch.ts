import type { Track } from "../types";

const DIACRITICS = /[\u0300-\u036f]/g;

/** Lowercase, strip accents, collapse whitespace — for loose name comparison. */
export function normName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Does `track` belong to the artist named `target`? Exact match on any of the
 * track's artist names, or a substring either way once both names are at least
 * 3 chars (so "bunny" finds "Bad Bunny" but a 1-letter query doesn't match
 * everything).
 */
function oneMatches(name: string, target: string): boolean {
  const n = normName(name);
  const t = normName(target);
  if (!n || !t) return false;
  if (n === t) return true;
  return t.length >= 3 && n.length >= 3 && (n.includes(t) || t.includes(n));
}

export function trackByArtist(track: Track, target: string): boolean {
  if (!normName(target)) return false;
  return (track.artists ?? []).some((a) => oneMatches(a, target));
}

/**
 * The artist name (as written on the track) that matched `target` — used to
 * show a properly-cased label instead of whatever the user typed.
 */
export function matchingArtistName(track: Track, target: string): string | null {
  return (track.artists ?? []).find((a) => oneMatches(a, target)) ?? null;
}
