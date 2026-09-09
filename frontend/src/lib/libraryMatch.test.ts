import { describe, expect, it } from "vitest";

import type { Track } from "../types";
import { normName, trackByArtist } from "./libraryMatch";

const t = (artists: string[]): Track => ({
  id: artists.join("|"),
  title: "x",
  artists,
});

describe("normName", () => {
  it("lowercases, strips accents and trims", () => {
    expect(normName("  Diomedes  DÍAZ ")).toBe("diomedes diaz");
    expect(normName("Björk")).toBe("bjork");
  });
});

describe("trackByArtist", () => {
  it("matches an exact artist name, accent-insensitively", () => {
    expect(trackByArtist(t(["Diomedes Díaz"]), "diomedes diaz")).toBe(true);
    expect(trackByArtist(t(["Eyedress"]), "eyedress")).toBe(true);
  });

  it("matches on a substring once both names are >= 3 chars", () => {
    expect(trackByArtist(t(["Bad Bunny"]), "bunny")).toBe(true);
    expect(trackByArtist(t(["Bad Bunny, Jhayco"]), "bad bunny")).toBe(true);
  });

  it("does not match on a 1-2 char query", () => {
    expect(trackByArtist(t(["Bad Bunny"]), "ba")).toBe(false);
  });

  it("does not match an unrelated artist", () => {
    expect(trackByArtist(t(["Shakira"]), "eyedress")).toBe(false);
  });

  it("checks every listed artist", () => {
    expect(trackByArtist(t(["J Balvin", "Eyedress"]), "eyedress")).toBe(true);
  });
});
