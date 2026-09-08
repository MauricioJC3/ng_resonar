import { beforeEach, describe, expect, it } from "vitest";

import type { AlbumCard, ArtistCard, Track } from "../types";
import {
  musicHistoryGo,
  resetSearch,
  setMusicSearch,
  videoHistoryGo,
} from "./search";

const song = (id: string): Track => ({ id, title: id, artists: [] });
const noMeta = { songs: [] as Track[], artists: [] as ArtistCard[], albums: [] as AlbumCard[] };

// The store is a singleton module; useSyncExternalStore isn't needed here — the
// exported navigators return the target query and mutate the snapshot, which is
// what the search views read.

beforeEach(() => {
  resetSearch();
});

describe("search history", () => {
  it("pushes each fresh search and steps back / forward through them", () => {
    setMusicSearch({ query: "one", ...noMeta });
    setMusicSearch({ query: "two", ...noMeta });
    setMusicSearch({ query: "three", ...noMeta });

    expect(musicHistoryGo(-1)).toBe("two");
    expect(musicHistoryGo(-1)).toBe("one");
    expect(musicHistoryGo(-1)).toBeNull(); // clamped at the start
    expect(musicHistoryGo(1)).toBe("two");
    expect(musicHistoryGo(1)).toBe("three");
    expect(musicHistoryGo(1)).toBeNull(); // clamped at the end
  });

  it("replaying a history entry (push=false) does not extend the history", () => {
    setMusicSearch({ query: "a", ...noMeta });
    setMusicSearch({ query: "b", ...noMeta });
    musicHistoryGo(-1); // cursor -> "a"
    setMusicSearch({ query: "a", ...noMeta, songs: [song("x")] }, false);

    // still just [a, b], cursor still on "a"
    expect(musicHistoryGo(1)).toBe("b");
    expect(musicHistoryGo(-1)).toBe("a");
  });

  it("a new search after stepping back truncates the forward entries", () => {
    setMusicSearch({ query: "a", ...noMeta });
    setMusicSearch({ query: "b", ...noMeta });
    setMusicSearch({ query: "c", ...noMeta });
    musicHistoryGo(-1); // -> "b"
    musicHistoryGo(-1); // -> "a"
    setMusicSearch({ query: "d", ...noMeta }); // branches from "a"

    expect(musicHistoryGo(1)).toBeNull(); // "d" is the newest
    expect(musicHistoryGo(-1)).toBe("a");
  });

  it("keeps music and video histories independent", () => {
    setMusicSearch({ query: "m1", ...noMeta });
    expect(videoHistoryGo(-1)).toBeNull();
  });

  it("resetSearch wipes the history", () => {
    setMusicSearch({ query: "one", ...noMeta });
    setMusicSearch({ query: "two", ...noMeta });
    resetSearch();
    expect(musicHistoryGo(-1)).toBeNull();
  });
});
