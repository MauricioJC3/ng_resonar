import { describe, expect, it } from "vitest";

import type { OfflineAlbumRef, OfflinePlaylistRef, OfflineTrack } from "../state/offline";
import { groupByAlbum, groupByPlaylist } from "./OfflineView";

const track = (
  id: string,
  opts: {
    album?: string | null;
    albums?: OfflineAlbumRef[];
    playlists?: OfflinePlaylistRef[];
  } = {},
): OfflineTrack => ({
  id,
  title: id,
  artists: [],
  album: opts.album,
  status: "ready",
  albums: opts.albums,
  playlists: opts.playlists,
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

describe("groupByPlaylist", () => {
  const pl1: OfflinePlaylistRef = { id: "pl1", name: "Campo de Batalla" };
  const pl2: OfflinePlaylistRef = { id: "pl2", name: "Otra playlist" };
  const albumA: OfflineAlbumRef = { id: "alb-a", name: "Álbum A" };

  it("keeps a playlist's tracks together even when they belong to different albums", () => {
    const { playlists, rest } = groupByPlaylist([
      track("a1", { albums: [albumA], playlists: [pl1] }),
      track("s1", { playlists: [pl1] }),
      track("c1", { albums: [albumA] }),
    ]);

    expect(playlists).toHaveLength(1);
    expect(playlists[0].name).toBe("Campo de Batalla");
    expect(playlists[0].tracks.map((t) => t.id)).toEqual(["a1", "s1"]);
    expect(rest.map((t) => t.id)).toEqual(["c1"]);
  });

  it("puts a track under every playlist it was downloaded from", () => {
    const { playlists } = groupByPlaylist([
      track("a1", { playlists: [pl1, pl2] }),
    ]);
    expect(playlists.map((p) => p.name).sort()).toEqual([
      "Campo de Batalla",
      "Otra playlist",
    ]);
  });

  it("leaves untagged tracks (album or single downloads) in `rest` for groupByAlbum", () => {
    const { playlists, rest } = groupByPlaylist([
      track("a1", { albums: [albumA] }),
      track("b1", {}),
    ]);
    expect(playlists).toEqual([]);
    expect(rest.map((t) => t.id)).toEqual(["a1", "b1"]);
  });
});
