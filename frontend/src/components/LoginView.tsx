import { useState, type FormEvent } from "react";

import { login } from "../api";
import type { AuthUser } from "../types";

interface Props {
  onSuccess: (user: AuthUser) => void;
}

export default function LoginView({ onSuccess }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const user = await login(username, password, remember);
      onSuccess(user);
    } catch {
      setError("Incorrect username or password.");
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <form className="auth__card" onSubmit={submit}>
        <h1 className="auth__title">Resonar</h1>
        <p className="auth__sub">Sign in to your library.</p>

        <div className="field">
          <input
            type="text"
            autoComplete="username"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            required
          />
        </div>
        <div className="field">
          <input
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <label className="auth__remember">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          Keep me signed in
        </label>

        {error && <p className="hint hint--error">{error}</p>}

        <button
          type="submit"
          className="btn btn--accent auth__submit"
          disabled={busy}
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
