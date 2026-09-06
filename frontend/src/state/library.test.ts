import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Track } from "../types";

vi.mock("../api", () => ({
  getFavorites: vi.fn(),
  addFavorite: vi.fn(),
  removeFavorite: vi.fn(),
}));

import { addFavorite, getFavorites, removeFavorite } from "../api";
import { isSaved, resetLibrary, toggleLibrary, useLibrary } from "./library";

const track = (id: string): Track => ({ id, title: id, artists: [] });

beforeEach(() => {
  vi.clearAllMocks();
  resetLibrary();
});

describe("library store", () => {
  it("seeds from GET /api/favorites: empty first, then populated", async () => {
    const favs = [track("a"), track("b")];
    vi.mocked(getFavorites).mockResolvedValue(favs);

    const { result } = renderHook(() => useLibrary());

    expect(result.current).toEqual([]);
    await waitFor(() => expect(result.current).toEqual(favs));
    expect(getFavorites).toHaveBeenCalledTimes(1);
  });

  it("toggleLibrary optimistically adds then removes, round-tripping to the server", async () => {
    vi.mocked(getFavorites).mockResolvedValue([]);
    vi.mocked(addFavorite).mockResolvedValue({ ok: true, added: true });
    vi.mocked(removeFavorite).mockResolvedValue({ ok: true, removed: true });

    const { result } = renderHook(() => useLibrary());
    await waitFor(() => expect(result.current).toEqual([]));

    await act(async () => {
      await toggleLibrary(track("x"));
    });
    expect(result.current.map((t) => t.id)).toEqual(["x"]);
    expect(addFavorite).toHaveBeenCalledWith(
      expect.objectContaining({ id: "x" }),
    );

    await act(async () => {
      await toggleLibrary(track("x"));
    });
    expect(result.current).toEqual([]);
    expect(removeFavorite).toHaveBeenCalledWith("x");
  });

  it("restores the previous array when the server rejects the toggle", async () => {
    vi.mocked(getFavorites).mockResolvedValue([track("keep")]);
    vi.mocked(addFavorite).mockRejectedValue(new Error("500"));

    const { result } = renderHook(() => useLibrary());
    await waitFor(() =>
      expect(result.current.map((t) => t.id)).toEqual(["keep"]),
    );

    await act(async () => {
      await toggleLibrary(track("new"));
    });

    expect(result.current.map((t) => t.id)).toEqual(["keep"]);
  });

  it("isSaved stays a pure lookup over the passed array", () => {
    const lib = [track("a"), track("b")];
    expect(isSaved("a", lib)).toBe(true);
    expect(isSaved("z", lib)).toBe(false);
  });
});
