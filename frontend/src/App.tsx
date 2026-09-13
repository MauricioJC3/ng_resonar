import { useCallback, useEffect, useState } from "react";

import { logout, me, SESSION_EXPIRED_EVENT } from "./api";
import AuthedApp from "./AuthedApp";
import BootstrapForm from "./components/BootstrapForm";
import ChangePasswordView from "./components/ChangePasswordView";
import LoginView from "./components/LoginView";
import { resetStores } from "./state/reset";
import { clearLastUser, loadLastUser, saveLastUser } from "./state/lastUser";
import type { AuthUser } from "./types";

export type View =
  | "home"
  | "search"
  | "videos"
  | "playlists"
  | "library"
  | "offline"
  | "history"
  | "settings";

type Gate =
  | "loading"
  | "bootstrap"
  | "login"
  | "authed"
  | "must-change-password";

export default function App() {
  const [gate, setGate] = useState<Gate>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);

  const enter = useCallback((u: AuthUser) => {
    saveLastUser(u);
    setUser(u);
    setGate(u.mustChangePassword ? "must-change-password" : "authed");
  }, []);

  // Cold start: ask the server who we are before rendering anything.
  useEffect(() => {
    let active = true;
    me()
      .then((res) => {
        if (!active) return;
        if (res.authenticated && res.user) {
          saveLastUser(res.user);
          setUser(res.user);
          setGate(
            res.user.mustChangePassword ? "must-change-password" : "authed",
          );
        } else if (res.bootstrapAvailable) {
          setGate("bootstrap");
        } else {
          setGate("login");
        }
      })
      .catch((err) => {
        if (!active) return;
        // A response with a `.status` means the server was reachable and
        // said something concrete (e.g. a 500) — nothing to recover from
        // here, so fall back to the login gate as before. A raw fetch
        // failure (no `.status`) means we couldn't reach the server at all —
        // most likely no network — in which case the session cookie may
        // still be perfectly valid, we just can't confirm it. Rather than
        // stranding the user on a login screen they also can't complete
        // offline, drop them back into the app as whoever last signed in on
        // this device so they can still play their downloaded music.
        const reachedServer = typeof (err as { status?: unknown })?.status === "number";
        const cached = reachedServer ? null : loadLastUser();
        if (cached) {
          setUser(cached);
          setGate(cached.mustChangePassword ? "must-change-password" : "authed");
        } else {
          setGate("login");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  // Any API 401 anywhere -> drop client state and return to the login gate.
  useEffect(() => {
    const onExpired = () => {
      clearLastUser();
      resetStores();
      setUser(null);
      setGate("login");
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  const onPasswordChanged = useCallback(() => {
    setUser((u) => (u ? { ...u, mustChangePassword: false } : u));
    setGate("authed");
  }, []);

  const onLogout = useCallback(() => {
    void logout().finally(() => {
      clearLastUser();
      resetStores();
      setUser(null);
      setGate("login");
    });
  }, []);

  if (gate === "loading") {
    return <div className="auth-splash">Resonar</div>;
  }
  if (gate === "bootstrap") {
    return <BootstrapForm onSuccess={enter} />;
  }
  if (gate === "login") {
    return <LoginView onSuccess={enter} />;
  }
  if (gate === "must-change-password") {
    return <ChangePasswordView forced onSuccess={onPasswordChanged} />;
  }
  return (
    <AuthedApp key={user?.id ?? "authed"} user={user} onLogout={onLogout} />
  );
}
