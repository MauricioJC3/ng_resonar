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
export function trackByArtist(track: Track, target: string): boolean {
  const t = normName(target);
  if (!t) return false;
  return (track.artists ?? []).some((a) => {
    const n = normName(a);
    if (!n) return false;
    if (n === t) return true;
    return t.length >= 3 && n.length >= 3 && (n.includes(t) || t.includes(n));
  });
}
