import { describe, expect, it } from "vitest";

import type { OfflineAlbumRef, OfflineCollectionRef, OfflineTrack } from "../state/offline";
import { groupByAlbum, groupByCollection } from "./OfflineView";

const track = (
  id: string,
  opts: {
    album?: string | null;
    albums?: OfflineAlbumRef[];
    collections?: OfflineCollectionRef[];
  } = {},
): OfflineTrack => ({
  id,
  title: id,
  artists: [],
  album: opts.album,
  status: "ready",
  albums: opts.albums,
  collections: opts.collections,
});

describe("groupByAlbum", () => {
  const albumA: OfflineAlbumRef = { id: "alb-a", name: "Álbum A" };
  const albumC: OfflineAlbumRef = { id: "alb-c", name: "Álbum C" };

  it("groups tracks tagged with the same album (downloaded via the album's own button)", () => {
    const { albums, loose } = groupByAlbum([
      track("a1", { albums: [albumA] }),
      track("b1", {}),
      track("a2", { albums: [albumA] }),
      track("c1", { albums: [albumC] }),
    ]);

    expect(albums).toHaveLength(2);
    const groupA = albums.find((g) => g.name === "Álbum A");
    expect(groupA?.tracks.map((t) => t.id)).toEqual(["a1", "a2"]);
    const groupC = albums.find((g) => g.name === "Álbum C");
    expect(groupC?.tracks.map((t) => t.id)).toEqual(["c1"]);

    expect(loose.map((t) => t.id)).toEqual(["b1"]);
  });

  it("does NOT group a track by its own `album` metadata alone — only an explicit album tag counts", () => {
    // A song downloaded on its own (search, the player, a track row) still
    // carries whatever album it originally belongs to on YouTube Music, but
    // that's not the same as the user downloading the whole album — it must
    // land in "Canciones", not get merged into an "Álbumes" group.
    const { albums, loose } = groupByAlbum([
      track("solo", { album: "Some Album" }),
    ]);
    expect(albums).toEqual([]);
    expect(loose.map((t) => t.id)).toEqual(["solo"]);
  });

  it("picks the first available thumbnail for the group", () => {
    const withThumb: OfflineTrack = {
      ...track("a2", { albums: [albumA] }),
      thumbnail: "art.jpg",
    };
    const { albums } = groupByAlbum([track("a1", { albums: [albumA] }), withThumb]);
    expect(albums[0].thumbnail).toBe("art.jpg");
  });

  it("returns no albums and no loose songs for an empty list", () => {
    expect(groupByAlbum([])).toEqual({ albums: [], loose: [] });
  });
});

describe("groupByCollection", () => {
  const pl1: OfflineCollectionRef = { id: "pl1", name: "Campo de Batalla" };
  const pl2: OfflineCollectionRef = { id: "artist:Alguien", name: "Alguien" };
  const albumA: OfflineAlbumRef = { id: "alb-a", name: "Álbum A" };

  it("keeps a playlist's tracks together even when they belong to different albums", () => {
    const { collections, rest } = groupByCollection([
      track("a1", { albums: [albumA], collections: [pl1] }),
      track("s1", { collections: [pl1] }),
      track("c1", { albums: [albumA] }),
    ]);

    expect(collections).toHaveLength(1);
    expect(collections[0].name).toBe("Campo de Batalla");
    expect(collections[0].tracks.map((t) => t.id)).toEqual(["a1", "s1"]);
    expect(rest.map((t) => t.id)).toEqual(["c1"]);
  });

  it("also groups an artist's favourites collection, the same way as a playlist", () => {
    const { collections } = groupByCollection([
      track("s1", { collections: [pl2] }),
    ]);
    expect(collections).toHaveLength(1);
    expect(collections[0].name).toBe("Alguien");
  });

  it("puts a track under every collection it was downloaded from", () => {
    const { collections } = groupByCollection([
      track("a1", { collections: [pl1, pl2] }),
    ]);
    expect(collections.map((c) => c.name).sort()).toEqual([
      "Alguien",
      "Campo de Batalla",
    ]);
  });

  it("leaves untagged tracks (album or single downloads) in `rest` for groupByAlbum", () => {
    const { collections, rest } = groupByCollection([
      track("a1", { albums: [albumA] }),
      track("b1", {}),
    ]);
    expect(collections).toEqual([]);
    expect(rest.map((t) => t.id)).toEqual(["a1", "b1"]);
  });
});
