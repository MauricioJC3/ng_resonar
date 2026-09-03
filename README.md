# Resonar

Un reproductor de música propio, tipo Spotify / YouTube Music, sin anuncios y
autohospedado.

- **Backend** — FastAPI + `ytmusicapi` (búsqueda) + `yt-dlp` + `ffmpeg`
  (streams y descargas). Cachea las URLs de stream (caducan) en Redis.
- **Frontend** — React + Vite + Plyr, servido por nginx que hace de proxy al API.
- **Todo dockerizado** — `docker compose up` y listo.

```
┌──────────┐   /api/*   ┌──────────┐   ytmusicapi / yt-dlp   ┌───────────┐
│ frontend │──────────▶ │ backend  │────────────────────────▶│  YouTube  │
│  nginx   │            │ FastAPI  │                         │  (Music)  │
└──────────┘            └────┬─────┘                         └───────────┘
                             │ cache de URLs de stream
                        ┌────▼─────┐
                        │  redis   │
                        └──────────┘
```

## Arranque rápido

```bash
git clone <este-repo> resonar && cd resonar
cp .env.example .env          # opcional
docker compose up --build
```

Abre <http://localhost:8080>.

## Desarrollo (sin Docker)

Backend:

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# necesitas ffmpeg en el PATH
uvicorn app.main:app --reload --port 8000
```

Frontend (proxya `/api` a `localhost:8000`):

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

## API

| Método | Ruta                      | Descripción                                        |
| ------ | ------------------------- | ------------------------------------------------- |
| GET    | `/api/search?q=&type=`    | Busca canciones (`type`: songs/videos/albums/…)    |
| GET    | `/api/suggest?q=`         | Autocompletado de búsqueda                         |
| GET    | `/api/related/{videoId}`  | Cola tipo "radio" a partir de una canción          |
| GET    | `/api/videos/search?q=`   | Busca videos en YouTube (yt-dlp flat search)       |
| GET    | `/api/videos/stream/{videoId}` | Video en streaming (proxy, soporta `Range`)   |
| GET    | `/api/stream/{videoId}`   | Audio en streaming (proxy, soporta `Range`)        |
| GET    | `/api/download/{videoId}?format=mp3` | Descarga el audio (`mp3`/`m4a`/`opus`/`flac`) con carátula y metadatos |
| GET    | `/api/sponsorblock/{videoId}` | Segmentos a saltar (proxy de SponsorBlock, cacheado) |
| GET    | `/api/lyrics?artist=&title=&album=&duration=` | Letra (proxy de LRCLIB; sincronizada si existe) |
| —      | `/api/playlists` (GET/POST) · `/api/playlists/{id}` (GET/PATCH/DELETE) · `.../tracks` (POST/PUT) · `.../tracks/{tid}` (DELETE) | CRUD de playlists (`POST` con `fromUrl` importa) |
| POST   | `/api/download/batch` `{ids,name,format}` | Inicia un ZIP de varias pistas; devuelve `jobId` |
| GET    | `/api/download/batch/{jobId}` · `.../file` | Estado del ZIP · descarga del ZIP |
| GET/PUT | `/api/settings`          | Credenciales de scrobbling (los secretos se ocultan en el GET) |
| POST   | `/api/scrobble/now-playing` · `/api/scrobble/submit` | Envía "reproduciendo ahora" / registra el listen |
| GET    | `/api/scrobble/lastfm/auth-url?callback=` · `.../callback` | Flujo de autorización de Last.fm |
| GET    | `/api/library/videos`     | Lista los videos guardados (con estado del trabajo) |
| POST   | `/api/library/videos/{videoId}?quality=1080` | Descarga+une video en HD y lo guarda (`force=true` para rehacer) |
| GET    | `/api/library/videos/{videoId}/file` | Reproduce el video guardado (soporta `Range`) |
| GET    | `/api/library/videos/{videoId}/download` | Descarga el archivo MP4 guardado |
| DELETE | `/api/library/videos/{videoId}` | Borra el video guardado |
| GET    | `/api/health`             | Healthcheck                                        |

**Videos en HD / guardados:** la vista rápida (`/api/videos/stream`) es baja
resolución. `POST /api/library/videos/{id}` baja el mejor video + audio por
separado y los une con ffmpeg a un MP4 (hasta 1080p+), lo guarda en el volumen
`./media` y lo deja re-reproducible y descargable. El trabajo corre en segundo
plano; el frontend consulta el estado hasta que queda `ready`. Ojo con el
espacio en disco: los archivos se acumulan en `./media` hasta que los borras.

El endpoint `/api/stream` resuelve la URL real con `yt-dlp`, la cachea (usa el
`expire=` de la propia URL como TTL) y hace de proxy de los bytes para que
funcione el *seek* y no haya problemas de CORS ni de IP.

**Videos:** `/api/videos/stream` usa el cliente `android` de yt-dlp para obtener
un MP4 combinado (audio+video en un solo archivo) que el `<video>` reproduce
directo. Eso limita la calidad a 360p (a veces 720p); resoluciones mayores en
YouTube son *adaptive* y necesitarían MSE/DASH en el cliente o un remux con
ffmpeg en el servidor.

## Atajos de teclado (música)

`Espacio` play/pausa · `←` / `→` ±5s · `N` siguiente · `P` anterior · `M` mute.
Cuando hay un video en pantalla, las teclas controlan el video.

**Radio infinita:** botón "Radio" en la barra inferior. Al acabar la última
canción de la cola, añade ~20 similares vía `/api/related` y sigue sola.

**Cola:** botón con el número de pistas → panel lateral para saltar, reordenar
(↑/↓) y quitar.

**SponsorBlock:** en la vista de video, salta patrocinios/intros/outros
automáticamente. Se puede apagar con el chip "SponsorBlock".

**Playlists:** sección propia. Se guardan en el servidor (`./data/playlists.json`),
así que se ven igual desde cualquier dispositivo. Se crean vacías, se importan
desde una URL de playlist/álbum de YouTube o YT Music, y desde la búsqueda se
añaden canciones con el botón ＋. "Descargar todo (MP3)" arma un ZIP en segundo
plano.

**Letra:** botón de letra en la barra → panel con la letra sincronizada
(resalta la línea actual; toca una línea para saltar ahí). Fuente: LRCLIB.

**Nivelar volumen:** botón en la barra. Pasa el audio por un compresor Web Audio
para que no salten los niveles entre canciones. Se recuerda encendido/apagado.

**PWA:** con `manifest.webmanifest` + `sw.js` la web es instalable (Añadir a la
pantalla de inicio → ventana propia sin barra del navegador). El service worker
cachea solo el "shell" y nunca toca `/api/`. Requiere HTTPS (tu túnel de
Cloudflare ya lo da). Controles en pantalla de bloqueo / auriculares vía
MediaSession (play/pausa, anterior/siguiente, ±10s, barra de progreso).

**Scrobbling (Ajustes):** ListenBrainz (pega tu *user token*) y Last.fm (crea una
API account, pega key + secret y pulsa "Conectar cuenta"). Se manda
"reproduciendo ahora" al empezar y el scrobble tras ~4 min o la mitad. Todo se
guarda en `./data/settings.json` (los secretos no se devuelven por la API).

## Notas de operación

- **`yt-dlp` se rompe con frecuencia** cuando YouTube cambia algo. Va sin fijar
  versión: `docker compose build --no-cache backend` para actualizarlo.
- **Bot checks** ("Sign in to confirm you're not a bot"): exporta un
  `cookies.txt` (formato Netscape) de una sesión con login, ponlo en
  `./config/cookies.txt` y descomenta `YTDLP_COOKIES` en `docker-compose.yml`.
- **Redis es opcional.** Sin `REDIS_URL` el backend usa una caché en memoria.
- Un solo worker de uvicorn por defecto (la caché en memoria no se comparte
  entre workers; con Redis puedes subir `--workers`).

## Legal

Pensado para **uso personal y autohospedado**. Reproducir/descargar contenido con
copyright puede infringir los Términos de YouTube y la ley de tu país. Para algo
público, apunta a fuentes con licencia libre (Jamendo, Audius, Free Music
Archive, Internet Archive).
