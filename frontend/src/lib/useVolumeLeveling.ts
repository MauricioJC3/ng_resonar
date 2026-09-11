import { useRef, useState, type RefObject } from "react";

const LEVEL_KEY = "resonar:level";

/**
 * Web Audio "volume leveling" for the player's `<audio>` element: routes it
 * through a DynamicsCompressorNode + GainNode so quiet and loud tracks land
 * at a closer perceived volume, instead of straight to the destination.
 *
 * Built lazily — the AudioContext/graph is only constructed the first time
 * leveling is turned on (never on mount), since creating a
 * MediaElementAudioSourceNode permanently "claims" the `<audio>` element for
 * that context. The on/off preference persists to localStorage so it
 * survives a reload; the graph itself does not.
 *
 * The caller owns the `<audio>` element and the Plyr instance around it, so
 * this hook exposes `resume`/`close` for the caller to invoke at the right
 * lifecycle points (e.g. on the "play" event a suspended AudioContext needs a
 * user-gesture resume, and on unmount the context must be closed).
 */
export function useVolumeLeveling(audioRef: RefObject<HTMLAudioElement | null>) {
  const [leveled, setLeveled] = useState(() => {
    try {
      return localStorage.getItem(LEVEL_KEY) === "1";
    } catch {
      return false;
    }
  });
  const audioCtxRef = useRef<AudioContext | null>(null);
  const graphRef = useRef<{
    src: MediaElementAudioSourceNode;
    comp: DynamicsCompressorNode;
    gain: GainNode;
  } | null>(null);

  function routeGraph(on: boolean) {
    const g = graphRef.current;
    const ctx = audioCtxRef.current;
    if (!g || !ctx) return;
    for (const n of [g.src, g.comp, g.gain]) {
      try {
        n.disconnect();
      } catch {
        /* ignore */
      }
    }
    if (on) {
      g.src.connect(g.comp);
      g.comp.connect(g.gain);
      g.gain.connect(ctx.destination);
    } else {
      g.src.connect(ctx.destination);
    }
  }

  function buildGraph() {
    if (graphRef.current || !audioRef.current) return;
    const Ctx: typeof AudioContext =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new Ctx();
    audioCtxRef.current = ctx;
    const src = ctx.createMediaElementSource(audioRef.current);
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -26;
    comp.knee.value = 28;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.25;
    const gain = ctx.createGain();
    gain.gain.value = 1.35;
    graphRef.current = { src, comp, gain };
  }

  function toggleLevel() {
    setLeveled((prevOn) => {
      const on = !prevOn;
      try {
        localStorage.setItem(LEVEL_KEY, on ? "1" : "0");
      } catch {
        /* ignore */
      }
      if (on) buildGraph();
      audioCtxRef.current?.resume?.();
      routeGraph(on);
      return on;
    });
  }

  // Resume a suspended AudioContext — call this from a play/gesture handler.
  function resume() {
    audioCtxRef.current?.resume?.();
  }

  // Close the AudioContext — call this on unmount.
  function close() {
    audioCtxRef.current?.close?.();
  }

  return { leveled, toggleLevel, resume, close };
}
