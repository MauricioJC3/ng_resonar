import { useEffect, useRef, useState } from "react";

import { isVideoActive } from "../state/mediabus";

/**
 * Roving keyboard selection over a list of rows (search results, an artist's
 * top songs, history…). ArrowDown / ArrowUp move a highlight, Enter activates
 * the highlighted row.
 *
 * Listens on `window` so it works right after a search without the user having
 * to focus the list, but stays out of the way while a text field is focused,
 * while the queue/lyrics drawer is open, or while a video is on screen (the
 * music/video shortcuts own the keyboard then). It only claims ArrowUp /
 * ArrowDown / Enter — never the Left/Right seek keys `PlayerBar` uses.
 *
 * Attach the returned `containerRef` to the element whose direct children are
 * the rows (one element per item); the hook scrolls the active row into view.
 */
export function useListKeyboard(
  count: number,
  onActivate: (index: number) => void,
  enabled = true,
) {
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLElement | null>(null);
  const activateRef = useRef(onActivate);
  activateRef.current = onActivate;

  // A shrinking / replaced list must not keep a stale highlight.
  useEffect(() => {
    setActiveIndex((i) => (i >= count ? -1 : i));
  }, [count]);

  useEffect(() => {
    if (!enabled || count === 0) return;

    const blocked = () => {
      const el = document.activeElement as HTMLElement | null;
      if (
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT" ||
          el.isContentEditable)
      )
        return true;
      if (isVideoActive()) return true;
      // A drawer that's actually open (the queue is now always in the DOM, just
      // collapsed) or the lyrics panel takes the arrow keys.
      if (document.querySelector(".drawer--open, .lyrics")) return true;
      return false;
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Enter")
        return;
      if (blocked()) return;

      if (e.key === "Enter") {
        setActiveIndex((i) => {
          if (i >= 0 && i < count) {
            e.preventDefault();
            activateRef.current(i);
          }
          return i;
        });
        return;
      }

      e.preventDefault();
      setActiveIndex((i) => {
        const next =
          e.key === "ArrowDown"
            ? Math.min(i < 0 ? 0 : i + 1, count - 1)
            : Math.max(i <= 0 ? 0 : i - 1, 0);
        const row = containerRef.current?.children[next] as
          | HTMLElement
          | undefined;
        row?.scrollIntoView({ block: "nearest" });
        return next;
      });
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [count, enabled]);

  return { activeIndex, setActiveIndex, containerRef };
}
