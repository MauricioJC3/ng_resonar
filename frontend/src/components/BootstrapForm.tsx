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
      setError("Las contraseñas no coinciden.");
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
          ? "La contraseña debe tener al menos 12 caracteres y no ser una contraseña común."
          : err instanceof ApiError && err.status === 403
            ? "Token de arranque inválido."
            : "No se pudo crear la cuenta de administrador.";
      setError(detail);
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <form className="auth__card" onSubmit={submit}>
        <h1 className="auth__title">Bienvenido a Resonar</h1>
        <p className="auth__sub">
          Creá la primera cuenta. Va a ser la de superadmin.
        </p>

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
            autoComplete="new-password"
            placeholder="Contraseña (mín. 12 caracteres)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <input
            type="password"
            autoComplete="new-password"
            placeholder="Confirmar contraseña"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <input
            type="password"
            placeholder="Token de arranque (si está configurado)"
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
          {busy ? "Creando…" : "Crear administrador"}
        </button>
      </form>
    </div>
  );
}
