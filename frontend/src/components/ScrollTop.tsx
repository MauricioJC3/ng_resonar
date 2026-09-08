import { useEffect, useState, type RefObject } from "react";

import { useVideo } from "../state/video";
import Icon from "./Icon";

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * "Back to top" button for the main scroll container. Fades in past ~600px of
 * scroll; nudges itself up when the video mini-player is on screen so the two
 * don't overlap.
 */
export default function ScrollTop({
  scrollRef,
}: {
  scrollRef: RefObject<HTMLElement>;
}) {
  const [show, setShow] = useState(false);
  const { current } = useVideo();

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setShow(el.scrollTop > 600);
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [scrollRef]);

  function toTop() {
    scrollRef.current?.scrollTo({
      top: 0,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }

  return (
    <button
      type="button"
      className={
        "scrolltop" +
        (show ? " is-visible" : "") +
        (current ? " scrolltop--raised" : "")
      }
      onClick={toTop}
      aria-label="Volver arriba"
      title="Volver arriba"
      tabIndex={show ? 0 : -1}
    >
      <Icon name="chevronUp" size={20} />
    </button>
  );
}
