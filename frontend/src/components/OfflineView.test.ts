import { describe, expect, it } from "vitest";

import type { OfflinePlaylistRef, OfflineTrack } from "../state/offline";
import { groupByAlbum, groupByPlaylist } from "./OfflineView";

const track = (
  id: string,
  album: string | null,
  playlists?: OfflinePlaylistRef[],
): OfflineTrack => ({
  id,
  title: id,
  artists: [],
  album,
  status: "ready",
  playlists,
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

describe("groupByPlaylist", () => {
  const pl1: OfflinePlaylistRef = { id: "pl1", name: "Campo de Batalla" };
  const pl2: OfflinePlaylistRef = { id: "pl2", name: "Otra playlist" };

  it("keeps a playlist's tracks together even when they belong to different albums", () => {
    const { playlists, rest } = groupByPlaylist([
      track("a1", "Álbum A", [pl1]),
      track("s1", null, [pl1]),
      track("c1", "Álbum C"),
    ]);

    expect(playlists).toHaveLength(1);
    expect(playlists[0].name).toBe("Campo de Batalla");
    expect(playlists[0].tracks.map((t) => t.id)).toEqual(["a1", "s1"]);
    expect(rest.map((t) => t.id)).toEqual(["c1"]);
  });

  it("puts a track under every playlist it was downloaded from", () => {
    const { playlists } = groupByPlaylist([track("a1", null, [pl1, pl2])]);
    expect(playlists.map((p) => p.name).sort()).toEqual([
      "Campo de Batalla",
      "Otra playlist",
    ]);
  });

  it("leaves untagged tracks (album or single downloads) in `rest` for groupByAlbum", () => {
    const { playlists, rest } = groupByPlaylist([
      track("a1", "Álbum A"),
      track("b1", null),
    ]);
    expect(playlists).toEqual([]);
    expect(rest.map((t) => t.id)).toEqual(["a1", "b1"]);
  });
});
