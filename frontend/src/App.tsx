import { useCallback, useEffect, useState } from "react";

import { logout, me, SESSION_EXPIRED_EVENT } from "./api";
import AuthedApp from "./AuthedApp";
import BootstrapForm from "./components/BootstrapForm";
import ChangePasswordView from "./components/ChangePasswordView";
import LoginView from "./components/LoginView";
import { resetStores } from "./state/reset";
import type { AuthUser } from "./types";

export type View =
  | "home"
  | "search"
  | "videos"
  | "playlists"
  | "library"
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
      .catch(() => {
        if (active) setGate("login");
      });
    return () => {
      active = false;
    };
  }, []);

  // Any API 401 anywhere -> drop client state and return to the login gate.
  useEffect(() => {
    const onExpired = () => {
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
  return <AuthedApp key={user?.id ?? "authed"} onLogout={onLogout} />;
}
