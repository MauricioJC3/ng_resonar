import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Track } from "../types";
import QueuePanel from "./QueuePanel";

const jumpTo = vi.fn();
const playerState = {
  queue: [] as Track[],
  index: 0,
  jumpTo,
  removeAt: vi.fn(),
  move: vi.fn(),
  shuffle: vi.fn(),
  enqueue: vi.fn(),
};

vi.mock("../state/player", () => ({
  usePlayer: () => playerState,
}));

vi.mock("../state/library", () => ({
  useLibrary: () => [],
  isSaved: () => false,
  toggleLibrary: vi.fn(),
}));

vi.mock("../state/playlists", () => ({
  usePlaylists: () => [],
}));

function press(key: string) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  });
}

const track = (id: string): Track => ({
  id,
  title: id,
  artists: [],
  album: null,
  duration: "",
  durationSeconds: 0,
  thumbnail: null,
});

function renderPanel(open: boolean) {
  playerState.queue = [track("a"), track("b"), track("c")];
  playerState.index = 0;
  return render(<QueuePanel open={open} onClose={() => {}} />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("QueuePanel", () => {
  // Arrow-key/Enter navigation was dropped here on purpose (it confused users
  // who weren't trying to reorder anything) — only drag-and-drop remains.
  it("does not react to arrow keys or Enter", () => {
    renderPanel(true);
    expect(screen.getByText("Cola · 3")).toBeInTheDocument();

    press("ArrowDown");
    press("ArrowDown");
    press("Enter");

    expect(jumpTo).not.toHaveBeenCalled();
    expect(document.querySelector(".qrow--selected")).toBeNull();
  });

  it("clicking a row still jumps to it", () => {
    renderPanel(true);
    fireEvent.click(screen.getByText("b"));
    expect(jumpTo).toHaveBeenCalledWith(1);
  });
});
