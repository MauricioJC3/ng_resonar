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
      setError("The new passwords do not match.");
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
          ? "Your current password is incorrect."
          : err instanceof ApiError && err.status === 422
            ? "New password must be at least 12 characters and not a common password."
            : "Could not change the password.";
      setError(detail);
      setBusy(false);
    }
  }

  const body = (
    <form className="auth__card" onSubmit={submit}>
      <h1 className="auth__title">Choose a new password</h1>
      <p className="auth__sub">
        {forced
          ? "Your account needs a new password before you can continue."
          : "Update the password for your account."}
      </p>

      <div className="field">
        <input
          type="password"
          autoComplete="current-password"
          placeholder="Current password"
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
          placeholder="New password (min. 12 characters)"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          required
        />
      </div>
      <div className="field">
        <input
          type="password"
          autoComplete="new-password"
          placeholder="Confirm new password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
      </div>

      {error && <p className="hint hint--error">{error}</p>}

      <div className="auth__actions">
        {!forced && onCancel && (
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="btn btn--accent auth__submit"
          disabled={busy}
        >
          {busy ? "Saving…" : "Save password"}
        </button>
      </div>
    </form>
  );

  return forced ? <div className="auth">{body}</div> : body;
}
