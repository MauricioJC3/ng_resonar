import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Track } from "../types";
import TrackRow from "./TrackRow";

const track: Track = { id: "t1", title: "Canción", artists: [] };

const downloadOffline = vi.fn();
const removeOffline = vi.fn();
let offlineTracks: Array<{ id: string; status: "downloading" | "ready" | "error" }> = [];

vi.mock("../state/offline", () => ({
  downloadOffline: (...args: unknown[]) => downloadOffline(...args),
  removeOffline: (...args: unknown[]) => removeOffline(...args),
  isOffline: (id: string, items: typeof offlineTracks) =>
    items.some((t) => t.id === id && t.status === "ready"),
  offlineStatus: (id: string, items: typeof offlineTracks) =>
    items.find((t) => t.id === id)?.status,
  useOfflineTracks: () => offlineTracks,
}));

vi.mock("../state/library", () => ({
  toggleLibrary: vi.fn(),
  useLibrary: () => [],
  isSaved: () => false,
}));

vi.mock("../state/player", () => ({
  usePlayer: () => ({ current: null, enqueue: vi.fn() }),
}));

vi.mock("../state/playlists", () => ({
  usePlaylists: () => [],
  useAllPlaylistDetails: () => [],
  addToPlaylist: vi.fn(),
  createPlaylist: vi.fn(),
}));

function offlineButton() {
  return screen.getByTitle(
    /Escuchar sin conexión|Quitar de escuchar sin conexión|Descarga fallida/,
  );
}

describe("TrackRow offline button", () => {
  it("offers to remove a track that finished downloading", () => {
    offlineTracks = [{ id: "t1", status: "ready" }];
    render(<TrackRow track={track} index={0} onPlay={() => {}} />);

    const btn = offlineButton();
    expect(btn.className).toContain("is-on");
    fireEvent.click(btn);
    expect(removeOffline).toHaveBeenCalledWith("t1");
  });

  it("still lets you remove a track whose download failed, instead of only retrying", () => {
    offlineTracks = [{ id: "t1", status: "error" }];
    render(<TrackRow track={track} index={0} onPlay={() => {}} />);

    const btn = offlineButton();
    expect(btn.className).toContain("is-error");
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(removeOffline).toHaveBeenCalledWith("t1");
  });

  it("disables the button while a download is in progress", () => {
    offlineTracks = [{ id: "t1", status: "downloading" }];
    render(<TrackRow track={track} index={0} onPlay={() => {}} />);

    const btn = screen.getByTitle("Escuchar sin conexión");
    expect(btn).toBeDisabled();
  });

  it("starts a download for a track that isn't offline yet", () => {
    offlineTracks = [];
    render(<TrackRow track={track} index={0} onPlay={() => {}} />);

    fireEvent.click(offlineButton());
    expect(downloadOffline).toHaveBeenCalledWith(track);
  });
});
