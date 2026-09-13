import { describe, expect, it } from "vitest";

import type { OfflineTrack } from "../state/offline";
import { groupByAlbum } from "./OfflineView";

const track = (id: string, album: string | null): OfflineTrack => ({
  id,
  title: id,
  artists: [],
  album,
  status: "ready",
});

describe("groupByAlbum", () => {
  it("groups tracks that share an album name and keeps the rest as loose songs", () => {
    const { albums, loose } = groupByAlbum([
      track("a1", "Álbum A"),
      track("b1", null),
      track("a2", "Álbum A"),
      track("c1", "Álbum C"),
      track("b2", ""),
    ]);

    expect(albums).toHaveLength(2);
    const albumA = albums.find((g) => g.album === "Álbum A");
    expect(albumA?.tracks.map((t) => t.id)).toEqual(["a1", "a2"]);
    const albumC = albums.find((g) => g.album === "Álbum C");
    expect(albumC?.tracks.map((t) => t.id)).toEqual(["c1"]);

    expect(loose.map((t) => t.id)).toEqual(["b1", "b2"]);
  });

  it("picks the first available thumbnail for the group", () => {
    const withThumb: OfflineTrack = {
      ...track("a2", "Álbum A"),
      thumbnail: "art.jpg",
    };
    const { albums } = groupByAlbum([track("a1", "Álbum A"), withThumb]);
    expect(albums[0].thumbnail).toBe("art.jpg");
  });

  it("returns no albums and no loose songs for an empty list", () => {
    expect(groupByAlbum([])).toEqual({ albums: [], loose: [] });
  });
});
