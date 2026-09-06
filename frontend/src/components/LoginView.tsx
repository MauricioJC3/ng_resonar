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
      setError("Usuario o contraseña incorrectos.");
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <form className="auth__card" onSubmit={submit}>
        <h1 className="auth__title">Resonar</h1>
        <p className="auth__sub">Ingresá a tu biblioteca.</p>

        <div className="field">
          <input
            type="text"
            autoComplete="username"
            placeholder="Usuario"
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
            placeholder="Contraseña"
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
          Mantener la sesión iniciada
        </label>

        {error && <p className="hint hint--error">{error}</p>}

        <button
          type="submit"
          className="btn btn--accent auth__submit"
          disabled={busy}
        >
          {busy ? "Ingresando…" : "Ingresar"}
        </button>
      </form>
    </div>
  );
}
