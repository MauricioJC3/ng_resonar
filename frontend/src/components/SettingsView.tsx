import { useState } from "react";

import { lastfmAuthUrl } from "../api";
import { refreshSettings, saveSettings, useSettings } from "../state/settings";

export default function SettingsView() {
  const s = useSettings();
  const [lbToken, setLbToken] = useState("");
  const [lfKey, setLfKey] = useState("");
  const [lfSecret, setLfSecret] = useState("");
  const [msg, setMsg] = useState("");

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
