import { useState } from "react";

import { lastfmAuthUrl } from "../api";
import { refreshSettings, saveSettings, useSettings } from "../state/settings";
import Icon from "./Icon";

type Theme = "light" | "dark";

function currentTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  const forced = document.documentElement.dataset.theme;
  if (forced === "light" || forced === "dark") return forced;
  // No explicit choice yet — reflect what the system (and the CSS) is showing.
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(next: Theme) {
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem("resonar:theme", next);
  } catch {
    /* private mode / storage disabled — theme still applies for this session */
  }
  const meta = document.querySelector('meta[name="theme-color"]:not([media])');
  if (meta) meta.setAttribute("content", next === "light" ? "#F1F4F3" : "#0E1414");
}

export default function SettingsView() {
  const s = useSettings();
  const [lbToken, setLbToken] = useState("");
  const [lfKey, setLfKey] = useState("");
  const [lfSecret, setLfSecret] = useState("");
  const [msg, setMsg] = useState("");
  const [theme, setTheme] = useState<Theme>(currentTheme);

  function toggleTheme() {
    const next: Theme = theme === "light" ? "dark" : "light";
    applyTheme(next);
    setTheme(next);
  }

  if (!s) {
    return (
      <div className="view">
        <p className="hint">Cargando…</p>
      </div>
    );
  }

  async function saveLb() {
    await saveSettings({ listenbrainz: { enabled: true, token: lbToken } });
    setLbToken("");
    setMsg("ListenBrainz guardado.");
  }

  async function saveLfKeys() {
    await saveSettings({ lastfm: { apiKey: lfKey, apiSecret: lfSecret } });
    setLfKey("");
    setLfSecret("");
    setMsg("Claves de Last.fm guardadas. Ahora conecta tu cuenta.");
  }

  async function connectLastfm() {
    try {
      const cb = `${window.location.origin}/api/scrobble/lastfm/callback`;
      const { url } = await lastfmAuthUrl(cb);
      window.open(url, "_blank", "noopener");
      setMsg("Autoriza en la pestaña nueva y luego pulsa «Actualizar estado».");
    } catch {
      setMsg("Guarda primero la API key y el secret.");
    }
  }

  return (
    <div className="view settings">
      <h1 className="view__title">Ajustes</h1>

      <section className="card">
        <div className="card__head">
          <h2>Tema</h2>
          <button
            type="button"
            className="chip theme-toggle"
            role="switch"
            aria-checked={theme === "light"}
            aria-label={
              theme === "light"
                ? "Cambiar al tema oscuro"
                : "Cambiar al tema claro"
            }
            onClick={toggleTheme}
          >
            <Icon name={theme === "light" ? "sun" : "moon"} size={15} />
            {theme === "light" ? "Claro" : "Oscuro"}
          </button>
        </div>
        <p className="card__sub">
          Se recuerda tu elección y se aplica antes de pintar la página. Sin una
          elección explícita se sigue el tema del sistema.
        </p>
      </section>

      <section className="card">
        <div className="card__head">
          <h2>ListenBrainz</h2>
          <button
            className={"chip" + (s.listenbrainz.enabled ? " chip--on" : "")}
            onClick={() =>
              saveSettings({
                listenbrainz: { enabled: !s.listenbrainz.enabled },
              })
            }
          >
            {s.listenbrainz.enabled ? "Activado" : "Desactivado"}
          </button>
        </div>
        <p className="card__sub">
          {s.listenbrainz.hasToken
            ? "Token guardado."
            : "Pega tu user token de listenbrainz.org/settings."}
        </p>
        <div className="field">
          <input
            type="password"
            placeholder="User token"
            value={lbToken}
            onChange={(e) => setLbToken(e.target.value)}
          />
          <button className="btn" disabled={!lbToken} onClick={saveLb}>
            Guardar
          </button>
        </div>
      </section>

      <section className="card">
        <div className="card__head">
          <h2>Last.fm</h2>
          <button
            className={"chip" + (s.lastfm.enabled ? " chip--on" : "")}
            onClick={() =>
              saveSettings({ lastfm: { enabled: !s.lastfm.enabled } })
            }
          >
            {s.lastfm.enabled ? "Activado" : "Desactivado"}
          </button>
        </div>
        <p className="card__sub">
          {s.lastfm.connected
            ? `Conectado como ${s.lastfm.username}.`
            : "Crea una API account en last.fm/api/account/create y pega la key y el secret."}
        </p>
        <div className="field">
          <input
            placeholder="API key"
            value={lfKey}
            onChange={(e) => setLfKey(e.target.value)}
          />
          <input
            type="password"
            placeholder="Shared secret"
            value={lfSecret}
            onChange={(e) => setLfSecret(e.target.value)}
          />
          <button
            className="btn"
            disabled={!lfKey || !lfSecret}
            onClick={saveLfKeys}
          >
            Guardar
          </button>
        </div>
        <div className="field">
          <button
            className="btn btn--accent"
            disabled={!s.lastfm.hasKeys}
            onClick={connectLastfm}
          >
            {s.lastfm.connected ? "Reconectar" : "Conectar cuenta"}
          </button>
          <button className="btn" onClick={() => refreshSettings()}>
            Actualizar estado
          </button>
        </div>
      </section>

      {msg && <p className="hint">{msg}</p>}
      <p className="card__sub">
        Se envía «reproduciendo ahora» al empezar cada canción y se registra el
        scrobble tras ~4 minutos o la mitad de su duración.
      </p>
    </div>
  );
}
