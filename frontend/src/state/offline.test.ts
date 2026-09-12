import "fake-indexeddb/auto";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Track } from "../types";

vi.mock("../api", () => ({
  streamUrl: (id: string) => `/api/stream/${id}`,
}));

import {
  downloadManyOffline,
  downloadOffline,
  getOfflineBlob,
  isOffline,
  offlineStatus,
  offlineTotalSize,
  removeOffline,
  useOfflineTracks,
} from "./offline";

// This module keeps one singleton store for the whole app lifetime (same
// shape as state/library.ts / state/savedVideos.ts), so — unlike those —
// there's no exported reset to call between tests (real downloaded bytes
// must survive logout/401; see the comment in offline.ts). Each test below
// uses its own track id instead of resetting shared state.
const track = (id: string): Track => ({ id, title: id, artists: [] });

function mockFetchOk(bytes: number) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(["x".repeat(bytes)])),
    }),
  );
}

function mockFetchFail() {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("offline store: pure helpers", () => {
  it("isOffline / offlineStatus / offlineTotalSize read the passed-in list", () => {
    const items = [
      { ...track("a"), status: "ready" as const, size: 100 },
      { ...track("b"), status: "downloading" as const },
    ];
    expect(isOffline("a", items)).toBe(true);
    expect(isOffline("b", items)).toBe(false);
    expect(isOffline("z", items)).toBe(false);
    expect(offlineStatus("b", items)).toBe("downloading");
    expect(offlineStatus("z", items)).toBeUndefined();
    expect(offlineTotalSize(items)).toBe(100);
  });
});

describe("offline store: downloads", () => {
  it("shows an optimistic 'downloading' placeholder, then 'ready' with the blob size", async () => {
    mockFetchOk(10);
    const { result } = renderHook(() => useOfflineTracks());

    let pending!: Promise<void>;
    act(() => {
      pending = downloadOffline(track("dl-placeholder"));
    });
    await waitFor(() =>
      expect(offlineStatus("dl-placeholder", result.current)).toBe(
        "downloading",
      ),
    );

    await act(() => pending);

    expect(
      result.current.find((t) => t.id === "dl-placeholder"),
    ).toMatchObject({ status: "ready", size: 10 });
  });

  it("marks a failed download as 'error', and a retry can still succeed", async () => {
    mockFetchFail();
    const { result } = renderHook(() => useOfflineTracks());

    await act(() => downloadOffline(track("dl-retry")));
    expect(offlineStatus("dl-retry", result.current)).toBe("error");

    mockFetchOk(5);
    await act(() => downloadOffline(track("dl-retry")));
    expect(offlineStatus("dl-retry", result.current)).toBe("ready");
  });

  it("removeOffline drops the track from the list and its stored blob", async () => {
    mockFetchOk(4);
    const { result } = renderHook(() => useOfflineTracks());

    await act(() => downloadOffline(track("dl-remove")));
    expect(await getOfflineBlob("dl-remove")).not.toBeNull();

    await act(() => removeOffline("dl-remove"));
    expect(result.current.find((t) => t.id === "dl-remove")).toBeUndefined();
    expect(await getOfflineBlob("dl-remove")).toBeNull();
  });

  it("downloadManyOffline downloads sequentially and skips what's already offline", async () => {
    mockFetchOk(2);
    const { result } = renderHook(() => useOfflineTracks());

    await act(() => downloadOffline(track("dl-many-a")));
    const fetchSpy = vi.mocked(fetch);
    fetchSpy.mockClear();

    await act(() =>
      downloadManyOffline([track("dl-many-a"), track("dl-many-b")]),
    );

    // "dl-many-a" was already offline — only "dl-many-b" should hit the network.
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(offlineStatus("dl-many-a", result.current)).toBe("ready");
    expect(offlineStatus("dl-many-b", result.current)).toBe("ready");
  });
});
