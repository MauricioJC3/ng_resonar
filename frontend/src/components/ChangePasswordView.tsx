import { useState, type FormEvent } from "react";

import { ApiError, changePassword } from "../api";

interface Props {
  /** Forced variant: mounted at the `must-change-password` gate, no way to skip. */
  forced?: boolean;
  onSuccess: () => void;
  onCancel?: () => void;
}

export default function ChangePasswordView({
  forced = false,
  onSuccess,
  onCancel,
}: Props) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (next !== confirm) {
      setError("Las nuevas contraseñas no coinciden.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await changePassword(current, next);
      onSuccess();
    } catch (err) {
      const detail =
        err instanceof ApiError && err.status === 403
          ? "Tu contraseña actual es incorrecta."
          : err instanceof ApiError && err.status === 422
            ? "La nueva contraseña debe tener al menos 12 caracteres y no ser una contraseña común."
            : "No se pudo cambiar la contraseña.";
      setError(detail);
      setBusy(false);
    }
  }

  const body = (
    <form className="auth__card" onSubmit={submit}>
      <h1 className="auth__title">Elegí una nueva contraseña</h1>
      <p className="auth__sub">
        {forced
          ? "Tu cuenta necesita una nueva contraseña antes de continuar."
          : "Actualizá la contraseña de tu cuenta."}
      </p>

      <div className="field">
        <input
          type="password"
          autoComplete="current-password"
          placeholder="Contraseña actual"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          autoFocus
          required
        />
      </div>
      <div className="field">
        <input
          type="password"
          autoComplete="new-password"
          placeholder="Nueva contraseña (mín. 12 caracteres)"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          required
        />
      </div>
      <div className="field">
        <input
          type="password"
          autoComplete="new-password"
          placeholder="Confirmar nueva contraseña"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
      </div>

      {error && <p className="hint hint--error">{error}</p>}

      <div className="auth__actions">
        {!forced && onCancel && (
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            Cancelar
          </button>
        )}
        <button
          type="submit"
          className="btn btn--accent auth__submit"
          disabled={busy}
        >
          {busy ? "Guardando…" : "Guardar contraseña"}
        </button>
      </div>
    </form>
  );

  return forced ? <div className="auth">{body}</div> : body;
}
