import { beforeEach, describe, expect, it } from "vitest";

import type { AlbumCard, ArtistCard, Track } from "../types";
import {
  musicHistoryGo,
  resetSearch,
  setMusicSearch,
  videoHistoryGo,
} from "./search";

const song = (id: string): Track => ({ id, title: id, artists: [] });
const res = (query: string, songs: Track[] = []) => ({
  query,
  songs,
  artists: [] as ArtistCard[],
  albums: [] as AlbumCard[],
});

beforeEach(() => {
  resetSearch();
});

describe("search history", () => {
  it("records each fresh search and steps back / forward through cached results", () => {
    setMusicSearch(res("one", [song("a")]));
    setMusicSearch(res("two", [song("b")]));
    setMusicSearch(res("three", [song("c")]));

    expect(musicHistoryGo(-1)?.query).toBe("two");
    expect(musicHistoryGo(-1)?.query).toBe("one");
    expect(musicHistoryGo(-1)).toBeNull(); // clamped at the start

    const fwd = musicHistoryGo(1);
    expect(fwd?.query).toBe("two");
    // results come back from cache, not a refetch
    expect(fwd?.songs.map((s) => s.id)).toEqual(["b"]);

    expect(musicHistoryGo(1)?.query).toBe("three");
    expect(musicHistoryGo(1)).toBeNull(); // clamped at the end
  });

  it("re-running the current query replaces its entry in place", () => {
    setMusicSearch(res("a"));
    setMusicSearch(res("b"));
    setMusicSearch(res("b", [song("x")])); // same query, fresher results

    expect(musicHistoryGo(-1)?.query).toBe("a");
    const b = musicHistoryGo(1);
    expect(b?.query).toBe("b");
    expect(b?.songs.map((s) => s.id)).toEqual(["x"]);
    expect(musicHistoryGo(1)).toBeNull(); // still only two entries
  });

  it("a new search after stepping back truncates the forward entries", () => {
    setMusicSearch(res("a"));
    setMusicSearch(res("b"));
    setMusicSearch(res("c"));
    musicHistoryGo(-1); // -> "b"
    musicHistoryGo(-1); // -> "a"
    setMusicSearch(res("d")); // branches from "a"

    expect(musicHistoryGo(1)).toBeNull(); // "d" is the newest
    expect(musicHistoryGo(-1)?.query).toBe("a");
  });

  it("keeps music and video histories independent", () => {
    setMusicSearch(res("m1"));
    expect(videoHistoryGo(-1)).toBeNull();
  });

  it("resetSearch wipes the history", () => {
    setMusicSearch(res("one"));
    setMusicSearch(res("two"));
    resetSearch();
    expect(musicHistoryGo(-1)).toBeNull();
  });
});
