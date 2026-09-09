import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Playlist, Track } from "../types";

const track = (id: string, artists: string[]): Track => ({
  id,
  title: id,
  artists,
});

let favourites: Track[] = [];
let playlists: Playlist[] = [];

vi.mock("./library", () => ({ useLibrary: () => favourites }));
vi.mock("./playlists", () => ({ useAllPlaylistDetails: () => playlists }));

import { useLibraryForArtist } from "./libraryArtist";

beforeEach(() => {
  favourites = [];
  playlists = [];
});

describe("useLibraryForArtist", () => {
  it("returns nothing when the name is empty", () => {
    favourites = [track("a", ["Eyedress"])];
    const { result } = renderHook(() => useLibraryForArtist(null));
    expect(result.current.tracks).toEqual([]);
  });

  it("collects favourites + playlist tracks by the artist, deduped", () => {
    favourites = [
      track("a", ["Eyedress"]),
      track("b", ["Shakira"]),
      track("c", ["Eyedress", "Dev Hynes"]),
    ];
    playlists = [
      {
        id: "p1",
        name: "Chill",
        count: 2,
        updatedAt: 0,
        createdAt: 0,
        tracks: [track("a", ["Eyedress"]), track("d", ["Eyedress"])],
      },
    ];

    const { result } = renderHook(() => useLibraryForArtist("eyedress"));

    expect(result.current.tracks.map((t) => t.id).sort()).toEqual([
      "a",
      "c",
      "d",
    ]);
    expect(result.current.savedCount).toBe(2); // a, c from favourites
    expect(result.current.inPlaylists).toEqual([
      { id: "p1", name: "Chill", count: 2 },
    ]);
  });

  it("returns empty when nothing matches", () => {
    favourites = [track("b", ["Shakira"])];
    const { result } = renderHook(() => useLibraryForArtist("eyedress"));
    expect(result.current.tracks).toEqual([]);
    expect(result.current.inPlaylists).toEqual([]);
  });
});
