// Native View Transitions API — not yet in the TS DOM lib for this toolchain.
interface ViewTransition {
  finished: Promise<void>;
  ready: Promise<void>;
  updateCallbackDone: Promise<void>;
  skipTransition(): void;
}

interface Document {
  startViewTransition?: (callback: () => void | Promise<void>) => ViewTransition;
}

// History entry payload used by App.tsx for back/forward view sync.
interface NavHistoryState {
  view?: string;
  watching?: unknown;
  openPlaylist?: string | null;
  np?: boolean;
}
