import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useListKeyboard } from "./useListKeyboard";

function press(key: string) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  });
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("useListKeyboard", () => {
  it("moves the highlight with the arrow keys and activates on Enter", () => {
    const onActivate = vi.fn();
    const { result } = renderHook(() => useListKeyboard(3, onActivate));

    expect(result.current.activeIndex).toBe(-1);

    press("ArrowDown");
    expect(result.current.activeIndex).toBe(0);
    press("ArrowDown");
    press("ArrowDown");
    press("ArrowDown"); // clamped at the last row
    expect(result.current.activeIndex).toBe(2);

    press("ArrowUp");
    expect(result.current.activeIndex).toBe(1);

    press("Enter");
    expect(onActivate).toHaveBeenCalledWith(1);
  });

  it("ignores the keys while a text field is focused", () => {
    const onActivate = vi.fn();
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    const { result } = renderHook(() => useListKeyboard(3, onActivate));
    press("ArrowDown");
    press("Enter");

    expect(result.current.activeIndex).toBe(-1);
    expect(onActivate).not.toHaveBeenCalled();
  });

  it("still works when a collapsed (not open) queue panel is in the DOM", () => {
    // Regression: the queue drawer is now always mounted, just collapsed. The
    // hook must only stand down for an *open* drawer.
    const onActivate = vi.fn();
    const closed = document.createElement("aside");
    closed.className = "drawer";
    document.body.appendChild(closed);

    const { result } = renderHook(() => useListKeyboard(3, onActivate));
    press("ArrowDown");
    expect(result.current.activeIndex).toBe(0);
    press("Enter");
    expect(onActivate).toHaveBeenCalledWith(0);
  });

  it("stands down while the queue panel is open", () => {
    const onActivate = vi.fn();
    const openDrawer = document.createElement("aside");
    openDrawer.className = "drawer drawer--open";
    document.body.appendChild(openDrawer);

    const { result } = renderHook(() => useListKeyboard(3, onActivate));
    press("ArrowDown");
    press("Enter");
    expect(result.current.activeIndex).toBe(-1);
    expect(onActivate).not.toHaveBeenCalled();
  });

  it("stands down while the full video watch view is on screen", () => {
    const onActivate = vi.fn();
    const watch = document.createElement("div");
    watch.className = "view watch";
    document.body.appendChild(watch);

    const { result } = renderHook(() => useListKeyboard(3, onActivate));
    press("ArrowDown");
    press("Enter");
    expect(result.current.activeIndex).toBe(-1);
    expect(onActivate).not.toHaveBeenCalled();
  });

  it("drops a stale highlight when the list shrinks", () => {
    const onActivate = vi.fn();
    const { result, rerender } = renderHook(
      ({ n }) => useListKeyboard(n, onActivate),
      { initialProps: { n: 5 } },
    );

    press("ArrowDown");
    press("ArrowDown");
    press("ArrowDown");
    expect(result.current.activeIndex).toBe(2);

    rerender({ n: 1 });
    expect(result.current.activeIndex).toBe(-1);
  });
});
