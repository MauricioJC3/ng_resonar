import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { Track } from "../types";
import { PlayerProvider, usePlayer } from "./player";

const track = (id: string): Track => ({ id, title: id, artists: [] });

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <PlayerProvider>{children}</PlayerProvider>
);

describe("player queue", () => {
  it("enqueue appends to the end without changing what's playing", () => {
    const { result } = renderHook(() => usePlayer(), { wrapper });

    act(() => result.current.playList([track("a"), track("b")], 0));
    act(() => result.current.enqueue(track("c")));

    expect(result.current.queue.map((t) => t.id)).toEqual(["a", "b", "c"]);
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
});
