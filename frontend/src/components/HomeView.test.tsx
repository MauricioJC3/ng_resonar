import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../api", async () => {
  const actual = await vi.importActual<typeof import("../api")>("../api");
  return {
    ...actual,
    getHistory: vi.fn(),
    homeMusic: vi.fn(),
    recommendations: vi.fn(),
  };
});

const playList = vi.fn();
vi.mock("../state/player", () => ({
  usePlayer: () => ({ playList }),
}));

import { getHistory, homeMusic, recommendations } from "../api";
import type { HistoryEntry, Track } from "../types";
import HomeView from "./HomeView";

const track = (id: string): Track => ({
  id,
  title: id,
  artists: [],
  album: null,
  duration: "",
  durationSeconds: 0,
  thumbnail: null,
});

const historyEntry = (id: string): HistoryEntry => ({
  videoId: id,
  title: id,
  artist: "",
  thumbnail: null,
  kind: "song",
  playedAt: 0,
  playCount: 1,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(recommendations).mockResolvedValue([]);
});

describe("HomeView roving cursor", () => {
  it("keeps the highlight in the right section when recent and feed swap in with equal lengths", async () => {
    // Regression: the "recently played" and "listen now" sections share ONE
    // useListKeyboard instance, switching which container owns listRef via
    // navOnRecent. If "feed" loads first (recent still empty, so navOnRecent
    // is false and the ref + click delegation bind to the feed container),
    // and "recent" then loads with a length that happens to equal feed's
    // length, navOnRecent flips to true but `count` is unchanged — so before
    // the HomeView-level fix, the click-delegation listener stayed bound to
    // the now-unreferenced feed container, and a click there moved the
    // shared activeIndex, which then rendered as a highlight on the WRONG
    // (recent) section and could activate the wrong track on Enter.
    let resolveFeed!: (v: Track[]) => void;
    let resolveRecent!: (v: HistoryEntry[]) => void;
    vi.mocked(homeMusic).mockReturnValue(
      new Promise((r) => (resolveFeed = r)),
    );
    vi.mocked(getHistory).mockReturnValue(
      new Promise((r) => (resolveRecent = r)),
    );

    render(<HomeView />);

    // Feed loads first with 2 tracks; recent is still empty so navOnRecent is
    // false and the ref/listener bind to the feed container.
    await act(async () => {
      resolveFeed([track("feed-0"), track("feed-1")]);
      await Promise.resolve();
    });
    await waitFor(() =>
      expect(screen.getByText("Escucha algo ahora")).toBeInTheDocument(),
    );

    // Recent then loads with the SAME length (2) — navOnRecent flips to true,
    // but count stays 2.
    await act(async () => {
      resolveRecent([historyEntry("rp-0"), historyEntry("rp-1")]);
      await Promise.resolve();
    });
    await waitFor(() =>
      expect(
        screen.getByText("Reproducido recientemente"),
      ).toBeInTheDocument(),
    );

    // Click a row in the (now non-navigating) feed section — this reaches
    // useListKeyboard's raw click-delegation listener via bubbling, which is
    // exactly the codepath that used to stay bound to the stale container.
    const feedSection = screen
      .getByText("Escucha algo ahora")
      .closest("section")!;
    const feedRows = feedSection.querySelectorAll(".track");
    expect(feedRows).toHaveLength(2);
    act(() => {
      fireEvent.click(feedRows[1]);
    });

    // Clicking a feed row must never highlight a row in the recent section.
    const recentSection = screen
      .getByText("Reproducido recientemente")
      .closest("section")!;
    expect(
      recentSection.querySelectorAll(".track--selected"),
    ).toHaveLength(0);

    // And Enter afterwards must not activate a track from the wrong list —
    // before the fix, the leaked click set the shared activeIndex, and Enter
    // would then call playList(recent, 1) even though the user clicked feed.
    fireEvent.keyDown(window, { key: "Enter" });
    expect(playList).not.toHaveBeenCalled();
  });
});
