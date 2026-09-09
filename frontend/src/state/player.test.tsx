import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Track } from "../types";
import { PlayerProvider, resetPlayerQueue, usePlayer } from "./player";

const track = (id: string): Track => ({ id, title: id, artists: [] });

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <PlayerProvider>{children}</PlayerProvider>
);

beforeEach(() => {
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
});

describe("player queue", () => {
  it("enqueue drops the track right after the current one", () => {
    const { result } = renderHook(() => usePlayer(), { wrapper });

    act(() => result.current.playList([track("a"), track("b"), track("c")], 1));
    // playing "b" (index 1)
    act(() => result.current.enqueue(track("x")));

    expect(result.current.queue.map((t) => t.id)).toEqual([
      "a",
      "b",
      "x",
      "c",
    ]);
    expect(result.current.current?.id).toBe("b");
    expect(result.current.index).toBe(1);
  });

  it("queueNext inserts several tracks after the current one, in order", () => {
    const { result } = renderHook(() => usePlayer(), { wrapper });

    act(() => result.current.playList([track("a"), track("b")], 0));
    act(() => result.current.queueNext([track("x"), track("y")]));

    expect(result.current.queue.map((t) => t.id)).toEqual([
      "a",
      "x",
      "y",
      "b",
    ]);
    expect(result.current.current?.id).toBe("a");
  });

  it("enqueue into an empty queue starts playing it", () => {
    const { result } = renderHook(() => usePlayer(), { wrapper });
    act(() => result.current.enqueue(track("a")));
    expect(result.current.queue.map((t) => t.id)).toEqual(["a"]);
    expect(result.current.current?.id).toBe("a");
  });

  it("shuffle keeps the current track in place and reorders the rest", () => {
    // Force a deterministic permutation.
    const spy = vi.spyOn(Math, "random").mockReturnValue(0);
    const { result } = renderHook(() => usePlayer(), { wrapper });

    const ids = ["a", "b", "c", "d", "e"];
    act(() => result.current.playList(ids.map(track), 2)); // playing "c"
    act(() => result.current.shuffle());

    expect(result.current.current?.id).toBe("c");
    expect(result.current.queue[2].id).toBe("c");
    expect([...result.current.queue.map((t) => t.id)].sort()).toEqual(
      [...ids].sort(),
    );
    spy.mockRestore();
  });

  it("shuffle is a no-op for very short queues", () => {
    const { result } = renderHook(() => usePlayer(), { wrapper });
    act(() => result.current.playList([track("a"), track("b")], 0));
    const before = result.current.queue;
    act(() => result.current.shuffle());
    expect(result.current.queue).toBe(before);
  });

  it("persists the queue and restores it on a fresh provider (reload)", () => {
    const first = renderHook(() => usePlayer(), { wrapper });
    act(() =>
      first.result.current.playList(
        [track("a"), track("b"), track("c")],
        1,
      ),
    );
    first.unmount();

    const { result } = renderHook(() => usePlayer(), { wrapper });
    expect(result.current.queue.map((t) => t.id)).toEqual(["a", "b", "c"]);
    expect(result.current.index).toBe(1);
    expect(result.current.current?.id).toBe("b");
  });

  it("resetPlayerQueue clears the persisted queue", () => {
    const { result } = renderHook(() => usePlayer(), { wrapper });
    act(() => result.current.playList([track("a")], 0));
    expect(localStorage.getItem("resonar:queue")).not.toBeNull();

    act(() => resetPlayerQueue());
    expect(result.current.queue).toEqual([]);
    expect(localStorage.getItem("resonar:queue")).toBeNull();
  });

  it("a finished track stays in the queue so prev can go back to it", () => {
    const { result } = renderHook(() => usePlayer(), { wrapper });
    act(() => result.current.playList([track("a"), track("b")], 0));
    act(() => result.current.next()); // "a" finished
    expect(result.current.current?.id).toBe("b");
    expect(result.current.queue.map((t) => t.id)).toEqual(["a", "b"]);
    act(() => result.current.prev());
    expect(result.current.current?.id).toBe("a");
  });
});
