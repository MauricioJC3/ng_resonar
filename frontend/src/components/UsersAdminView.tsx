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
    return "Ese nombre de usuario ya está en uso.";
  }
  if (err instanceof ApiError && err.status === 422) {
    return "La contraseña debe tener al menos 12 caracteres y no ser una contraseña común.";
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
      .catch(() => setError("No se pudo cargar la lista de usuarios."));
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
        `Usuario "${created.username}" creado. Pasale esta contraseña temporal ` +
          `— la tiene que cambiar al entrar por primera vez: ${pass}`,
      );
      setName("");
      setPass("");
      refresh();
    } catch (err) {
      setError(passwordError(err, "No se pudo crear el usuario."));
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(target: UserSummary) {
    setError(null);
    setInfo(null);
    if (
      !window.confirm(
        `¿Eliminar a "${target.username}"? También se borran sus playlists, ` +
          "favoritos e historial.",
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
          ? "No podés eliminar al último superadmin."
          : "No se pudo eliminar el usuario.",
      );
    }
  }

  async function onSetPassword(target: UserSummary) {
    setError(null);
    setInfo(null);
    const next = window.prompt(
      `Nueva contraseña para "${target.username}" (mín. 12 caracteres):`,
    );
    if (!next) return;
    try {
      await adminSetPassword(target.id, next);
      setInfo(
        `Contraseña de "${target.username}" actualizada. La tiene que cambiar ` +
          `en el próximo ingreso. Compartí: ${next}`,
      );
      refresh();
    } catch (err) {
      setError(
        passwordError(err, "No se pudo actualizar la contraseña."),
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
