import { flushSync } from "react-dom";

function reducedMotion(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Apply a synchronous state update inside a View Transition, tagging `el` so
 * only that subtree cross-fades (not the whole page). `el` must be a stable
 * node — don't remount it while the transition captures its before/after. Falls
 * back to a plain update when View Transitions aren't available or motion is
 * reduced.
 */
export function swapWithTransition(
  el: HTMLElement | null,
  name: string,
  apply: () => void,
) {
  const start = document.startViewTransition?.bind(document);
  if (!start || !el || reducedMotion()) {
    apply();
    return;
  }
  el.style.viewTransitionName = name;
  const clear = () => {
    el.style.viewTransitionName = "";
  };
  try {
    const t = start(() => flushSync(apply));
    t.finished.then(clear, clear);
  } catch {
    clear();
    apply();
  }
}
