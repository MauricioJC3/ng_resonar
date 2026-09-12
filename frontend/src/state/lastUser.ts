import type { AuthUser } from "../types";

// Last known authenticated user, persisted client-side. Used only as a
// fallback when a cold start can't even reach the server (no network) — the
// session cookie itself might still be perfectly valid, we just can't ask.
// Without this, App.tsx had no way to tell "no network" apart from "no
// session" and always bounced to the login gate, which strands a user with
// downloaded offline tracks and no way to sign back in.

const KEY = "resonar:lastUser";

export function saveLastUser(user: AuthUser): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(user));
  } catch {
    /* private mode / storage disabled — offline fallback just won't work */
  }
}

export function loadLastUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function clearLastUser(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
