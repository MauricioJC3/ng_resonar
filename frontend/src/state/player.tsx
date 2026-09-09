import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";

import type { Track } from "../types";
import { shuffled } from "../lib/shuffle";

const RADIO_KEY = "resonar:radio";

interface State {
  queue: Track[];
  index: number;
  radio: boolean;
}

type Action =
  | { type: "playList"; queue: Track[]; index: number }
  | { type: "next" }
  | { type: "prev" }
  | { type: "jumpTo"; index: number }
  | { type: "enqueue"; track: Track }
  | { type: "queueNext"; tracks: Track[] }
  | { type: "appendMany"; tracks: Track[] }
  | { type: "removeAt"; at: number }
  | { type: "move"; from: number; to: number }
  | { type: "shuffle" }
  | { type: "toggleRadio" }
  | { type: "reset" };

function clampIndex(i: number, len: number) {
  return Math.max(0, Math.min(i, Math.max(0, len - 1)));
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "playList":
      return { ...state, queue: action.queue, index: action.index };

    case "next":
      return state.index < state.queue.length - 1
        ? { ...state, index: state.index + 1 }
        : state;

    case "prev":
      return state.index > 0 ? { ...state, index: state.index - 1 } : state;

    case "jumpTo":
      return { ...state, index: clampIndex(action.index, state.queue.length) };

    case "enqueue":
    case "queueNext": {
      const tracks =
        action.type === "enqueue" ? [action.track] : action.tracks;
      if (tracks.length === 0) return state;
      // Empty queue: this becomes the queue and starts playing.
      if (state.queue.length === 0) {
        return { ...state, queue: [...tracks], index: 0 };
      }
      // Otherwise drop them right after whatever is playing (Spotify-style),
      // leaving the current track and index untouched.
      const at = state.index + 1;
      return {
        ...state,
        queue: [
          ...state.queue.slice(0, at),
          ...tracks,
          ...state.queue.slice(at),
        ],
      };
    }

    case "appendMany": {
      const have = new Set(state.queue.map((t) => t.id));
      const fresh = action.tracks.filter((t) => !have.has(t.id));
      return fresh.length
        ? { ...state, queue: [...state.queue, ...fresh] }
        : state;
    }

    case "removeAt": {
      const at = action.at;
      if (at < 0 || at >= state.queue.length) return state;
      const queue = state.queue.filter((_, i) => i !== at);
      let index = state.index;
      if (at < state.index) index -= 1;
      else if (at === state.index) index = Math.min(index, queue.length - 1);
      return { ...state, queue, index: Math.max(0, index) };
    }

    case "move": {
      const { from, to } = action;
      if (
        from === to ||
        from < 0 ||
        to < 0 ||
        from >= state.queue.length ||
        to >= state.queue.length
      )
        return state;
      const queue = state.queue.slice();
      const [item] = queue.splice(from, 1);
      queue.splice(to, 0, item);
      let index = state.index;
      if (from === state.index) index = to;
      else if (from < state.index && to >= state.index) index -= 1;
      else if (from > state.index && to <= state.index) index += 1;
      return { ...state, queue, index };
    }

    case "shuffle": {
      if (state.queue.length < 3) return state;
      // Keep whatever is playing exactly where it is; shuffle everything else.
      const current = state.queue[state.index];
      const rest = shuffled(state.queue.filter((_, i) => i !== state.index));
      rest.splice(state.index, 0, current);
      return { ...state, queue: rest };
    }

    case "toggleRadio": {
      const radio = !state.radio;
      try {
        localStorage.setItem(RADIO_KEY, radio ? "1" : "0");
      } catch {
        /* ignore */
      }
      return { ...state, radio };
    }

    case "reset":
      return { queue: [], index: 0, radio: state.radio };
  }
}

interface PlayerApi {
  queue: Track[];
  index: number;
  current: Track | undefined;
  hasNext: boolean;
  hasPrev: boolean;
  radio: boolean;
  playList: (tracks: Track[], index: number) => void;
  next: () => void;
  prev: () => void;
  jumpTo: (index: number) => void;
  /** Add one track right after the current one. */
  enqueue: (track: Track) => void;
  /** Add several tracks right after the current one, in order. */
  queueNext: (tracks: Track[]) => void;
  appendMany: (tracks: Track[]) => void;
  removeAt: (at: number) => void;
  move: (from: number, to: number) => void;
  shuffle: () => void;
  toggleRadio: () => void;
}

const PlayerContext = createContext<PlayerApi | null>(null);

// The queue lives in React state, but state/reset.ts is a plain module. The
// mounted provider parks a queue-clear here so resetStores() can reach it.
let clearQueue: (() => void) | null = null;

/** Clear the play queue on logout / session expiry (no-op if unmounted). */
export function resetPlayerQueue() {
  clearQueue?.();
}

function initState(): State {
  let radio = false;
  try {
    radio = localStorage.getItem(RADIO_KEY) === "1";
  } catch {
    /* ignore */
  }
  return { queue: [], index: 0, radio };
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initState);

  useEffect(() => {
    clearQueue = () => dispatch({ type: "reset" });
    return () => {
      clearQueue = null;
    };
  }, []);

  const api = useMemo<PlayerApi>(
    () => ({
      queue: state.queue,
      index: state.index,
      current: state.queue[state.index],
      hasNext: state.index < state.queue.length - 1,
      hasPrev: state.index > 0,
      radio: state.radio,
      playList: (tracks, index) => dispatch({ type: "playList", queue: tracks, index }),
      next: () => dispatch({ type: "next" }),
      prev: () => dispatch({ type: "prev" }),
      jumpTo: (index) => dispatch({ type: "jumpTo", index }),
      enqueue: (track) => dispatch({ type: "enqueue", track }),
      queueNext: (tracks) => dispatch({ type: "queueNext", tracks }),
      appendMany: (tracks) => dispatch({ type: "appendMany", tracks }),
      removeAt: (at) => dispatch({ type: "removeAt", at }),
      move: (from, to) => dispatch({ type: "move", from, to }),
      shuffle: () => dispatch({ type: "shuffle" }),
      toggleRadio: () => dispatch({ type: "toggleRadio" }),
    }),
    [state],
  );

  return <PlayerContext.Provider value={api}>{children}</PlayerContext.Provider>;
}

export function usePlayer(): PlayerApi {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used inside <PlayerProvider>");
  return ctx;
}
