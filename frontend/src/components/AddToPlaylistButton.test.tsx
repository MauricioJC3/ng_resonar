import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Playlist, PlaylistSummary, Track } from "../types";
import AddToPlaylistButton from "./AddToPlaylistButton";

const summaries: PlaylistSummary[] = [
  { id: "p1", name: "Playlist con la canción", count: 1, thumbnail: null, updatedAt: 0 },
  { id: "p2", name: "Otra playlist", count: 0, thumbnail: null, updatedAt: 0 },
];

const track: Track = { id: "t1", title: "Canción", artists: [] };

const details: Playlist[] = [
  { ...summaries[0], tracks: [track], createdAt: 0 },
  { ...summaries[1], tracks: [], createdAt: 0 },
];

vi.mock("../state/playlists", () => ({
  usePlaylists: () => summaries,
  useAllPlaylistDetails: () => details,
  addToPlaylist: vi.fn(),
  createPlaylist: vi.fn(),
}));

describe("AddToPlaylistButton", () => {
  it("marks the playlist(s) that already contain this track when the menu opens", () => {
    render(<AddToPlaylistButton track={track} />);
    fireEvent.click(screen.getByRole("button", { name: "Añadir a una playlist" }));

    const withTrack = screen.getByRole("button", { name: /Playlist con la canción/ });
    const withoutTrack = screen.getByRole("button", { name: "Otra playlist" });

    expect(withTrack.className).toContain("track__menu-item--in");
    expect(withoutTrack.className).not.toContain("track__menu-item--in");
  });

  it("doesn't mark anything when adding a whole list (e.g. an album)", () => {
    render(<AddToPlaylistButton track={[track]} />);
    fireEvent.click(screen.getByRole("button", { name: "Añadir a una playlist" }));

    for (const btn of screen.getAllByRole("button")) {
      expect(btn.className).not.toContain("track__menu-item--in");
    }
  });
});
