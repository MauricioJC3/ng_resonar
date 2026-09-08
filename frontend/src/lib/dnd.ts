import type { DragEvent } from "react";

import type { Track } from "../types";

// Shared drag payload for tracks. Used to drag a queue row (or any TrackRow)
// onto the "Biblioteca" nav item / favourites list, and to reorder the queue.

const MIME = "application/resonar-track";

export function setTrackDrag(e: DragEvent, track: Track) {
  try {
    e.dataTransfer.setData(MIME, JSON.stringify(track));
    // A text/plain fallback keeps the drag valid across browsers that are picky
    // about custom MIME types before drop.
    e.dataTransfer.setData("text/plain", track.title ?? "");
    e.dataTransfer.effectAllowed = "copyMove";
  } catch {
    /* ignore */
  }
}

/** True when a dragover event carries our track payload. */
export function hasTrackDrag(e: DragEvent): boolean {
  return Array.from(e.dataTransfer.types).includes(MIME);
}

export function readTrackDrag(e: DragEvent): Track | null {
  try {
    const raw = e.dataTransfer.getData(MIME);
    if (!raw) return null;
    const t = JSON.parse(raw) as Track;
    return t && typeof t.id === "string" ? t : null;
  } catch {
    return null;
  }
}
