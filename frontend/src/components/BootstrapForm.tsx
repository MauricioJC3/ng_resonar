import { useState, type FormEvent } from "react";

import { ApiError, bootstrapSuperadmin } from "../api";
import type { AuthUser } from "../types";

interface Props {
  onSuccess: (user: AuthUser) => void;
}

export default function BootstrapForm({ onSuccess }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("The passwords do not match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const user = await bootstrapSuperadmin(username, password, token.trim());
      onSuccess(user);
    } catch (err) {
      const detail =
        err instanceof ApiError && err.status === 422
          ? "Password must be at least 12 characters and not a common password."
          : err instanceof ApiError && err.status === 403
            ? "Invalid bootstrap token."
            : "Could not create the administrator account.";
      setError(detail);
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <form className="auth__card" onSubmit={submit}>
        <h1 className="auth__title">Welcome to Resonar</h1>
        <p className="auth__sub">
          Create the first account. It becomes the superadmin.
        </p>

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
            autoComplete="new-password"
            placeholder="Password (min. 12 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <input
            type="password"
            autoComplete="new-password"
            placeholder="Confirm password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <input
            type="password"
            placeholder="Bootstrap token (if configured)"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
        </div>

        {error && <p className="hint hint--error">{error}</p>}

        <button
          type="submit"
          className="btn btn--accent auth__submit"
          disabled={busy}
        >
          {busy ? "Creating…" : "Create administrator"}
        </button>
      </form>
    </div>
  );
}
