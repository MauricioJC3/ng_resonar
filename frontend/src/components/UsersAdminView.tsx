import { useCallback, useEffect, useState, type FormEvent } from "react";

import {
  adminSetPassword,
  ApiError,
  createUser,
  deleteUser,
  listUsers,
} from "../api";
import type { AuthUser, UserSummary } from "../types";

interface Props {
  /** The signed-in user. The panel only renders for a superadmin. */
  user: AuthUser;
}

function passwordError(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.status === 409) {
    return "That username is already taken.";
  }
  if (err instanceof ApiError && err.status === 422) {
    return "Password must be at least 12 characters and not a common one.";
  }
  return fallback;
}

export default function UsersAdminView({ user }: Props) {
  const isAdmin = user.role === "superadmin";

  const [users, setUsers] = useState<UserSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    if (!isAdmin) return;
    listUsers()
      .then(setUsers)
      .catch(() => setError("Could not load the user list."));
  }, [isAdmin]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!isAdmin) return null;

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const created = await createUser(name.trim(), pass);
      setInfo(
        `User "${created.username}" created. Share this one-time password with ` +
          `them — they must set their own on first login: ${pass}`,
      );
      setName("");
      setPass("");
      refresh();
    } catch (err) {
      setError(passwordError(err, "Could not create the user."));
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(target: UserSummary) {
    setError(null);
    setInfo(null);
    if (
      !window.confirm(
        `Delete "${target.username}"? Their playlists, favorites and history ` +
          "are removed too.",
      )
    ) {
      return;
    }
    try {
      await deleteUser(target.id);
      refresh();
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 409
          ? "You cannot delete the last superadmin."
          : "Could not delete the user.",
      );
    }
  }

  async function onSetPassword(target: UserSummary) {
    setError(null);
    setInfo(null);
    const next = window.prompt(
      `New password for "${target.username}" (min. 12 characters):`,
    );
    if (!next) return;
    try {
      await adminSetPassword(target.id, next);
      setInfo(
        `Password for "${target.username}" updated. They must change it on ` +
          `next login. Share: ${next}`,
      );
      refresh();
    } catch (err) {
      setError(
        passwordError(err, "Could not update the password."),
      );
    }
  }

  return (
    <section className="card">
      <div className="card__head">
        <h2>Usuarios</h2>
      </div>
      <p className="card__sub">
        Solo un superadmin puede crear, listar o eliminar cuentas. Las cuentas
        nuevas empiezan con una contraseña temporal y deben cambiarla al entrar.
      </p>

      <form className="field" onSubmit={onCreate}>
        <input
          placeholder="Nombre de usuario"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Contraseña temporal (mín. 12)"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          required
        />
        <button
          type="submit"
          className="btn btn--accent"
          disabled={busy || !name.trim() || !pass}
        >
          {busy ? "Creando…" : "Crear usuario"}
        </button>
      </form>

      {error && <p className="hint hint--error">{error}</p>}
      {info && <p className="hint">{info}</p>}

      <ul className="user-list">
        {users.map((u) => (
          <li key={u.id} className="user-list__row">
            <span className="user-list__name">
              {u.username}
              {u.role === "superadmin" && (
                <span className="chip chip--on"> superadmin</span>
              )}
              {u.mustChangePassword && (
                <span className="chip"> debe cambiar contraseña</span>
              )}
            </span>
            <span className="user-list__actions">
              <button
                type="button"
                className="btn"
                onClick={() => onSetPassword(u)}
              >
                Cambiar contraseña
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => onDelete(u)}
                disabled={u.id === user.id}
              >
                Eliminar
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
