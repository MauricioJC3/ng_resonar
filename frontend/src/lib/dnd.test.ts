import { describe, expect, it } from "vitest";
import type { DragEvent } from "react";

import type { Track } from "../types";
import { hasTrackDrag, readTrackDrag, setTrackDrag } from "./dnd";

// Minimal DataTransfer stand-in — jsdom doesn't provide one for synthetic events.
function fakeEvent() {
  const store = new Map<string, string>();
  const dt = {
    setData: (type: string, val: string) => store.set(type, val),
    getData: (type: string) => store.get(type) ?? "",
    get types() {
      return Array.from(store.keys());
    },
    effectAllowed: "none",
    dropEffect: "none",
  };
  return { dataTransfer: dt } as unknown as DragEvent;
}

const track: Track = {
  id: "abc123",
  title: "Song",
  artists: ["A", "B"],
  thumbnail: "t.jpg",
};

describe("track drag payload", () => {
  it("round-trips a track through the drag data", () => {
    const e = fakeEvent();
    setTrackDrag(e, track);
    expect(hasTrackDrag(e)).toBe(true);
    expect(readTrackDrag(e)).toEqual(track);
  });

  it("reports no track when the payload is absent", () => {
    const e = fakeEvent();
    expect(hasTrackDrag(e)).toBe(false);
    expect(readTrackDrag(e)).toBeNull();
  });

  it("returns null on a malformed payload instead of throwing", () => {
    const e = fakeEvent();
    e.dataTransfer.setData("application/resonar-track", "{not json");
    expect(readTrackDrag(e)).toBeNull();
  });
});
