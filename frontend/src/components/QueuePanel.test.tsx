import { act, render, screen } from "@testing-library/react";
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

// The hook's Enter handling calls onActivate() (here, jumpTo) from inside a
// setState updater — real with the actual PlayerProvider reducer that trips
// React's "update while rendering a different component" guard in tests
// (harmless in the app, since the two updates still land in the same batch).
// A plain spy sidesteps that noise and keeps the assertion focused on what
// this test actually cares about: which real-queue index got activated.
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

describe("QueuePanel keyboard navigation", () => {
  it("arrow keys move the highlight over queue rows and Enter jumps to it", () => {
    renderPanel(true);
    expect(screen.getByText("Cola · 3")).toBeInTheDocument();

    press("ArrowDown");
    let rows = document.querySelectorAll(".qrow");
    expect(rows[0]).toHaveClass("qrow--selected");

    press("ArrowDown");
    rows = document.querySelectorAll(".qrow");
    expect(rows[1]).toHaveClass("qrow--selected");
    expect(rows[0]).not.toHaveClass("qrow--selected");

    press("Enter");
    // Jumps to the real queue index for the highlighted row: index (0) + the
    // local visible-slice index (1) = "b" at real queue index 1.
    expect(jumpTo).toHaveBeenCalledWith(1);
  });

  it("does nothing while the drawer is closed", () => {
    renderPanel(false);
    expect(screen.getByText("Cola · 3")).toBeInTheDocument();

    press("ArrowDown");
    press("Enter");

    expect(document.querySelector(".qrow--selected")).toBeNull();
    expect(jumpTo).not.toHaveBeenCalled();
  });
});
