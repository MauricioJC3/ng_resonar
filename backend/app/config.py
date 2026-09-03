from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuration read from environment variables (case-insensitive)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Cache backend. If unset, an in-process TTL cache is used instead of Redis.
    redis_url: str | None = None

    # How long a resolved stream URL stays cached (seconds). googlevideo URLs
    # usually live ~6h; the real expiry is read from the URL when possible and
    # this is only the fallback / upper bound.
    stream_cache_ttl: int = 18_000
    search_cache_ttl: int = 900
    suggest_cache_ttl: int = 3_600

    # Comma-separated list. "*" allows any origin (fine for local self-hosting).
    cors_origins: str = "*"

    # Where saved (HD, merged) videos live. Mount a volume here to keep them.
    media_dir: str = "/media"
    # Playlists JSON + batch-download zips. Mount a volume here to keep them.
    data_dir: str = "/data"
    # How many HD video downloads may run at once.
    video_download_concurrency: int = 2

    # Optional Netscape cookies.txt exported from a logged-in YouTube session.
    # Helps when extraction hits "Sign in to confirm you're not a bot".
    ytdlp_cookies: str | None = None
    # Optional upstream proxy for yt-dlp, e.g. http://user:pass@host:port
    ytdlp_proxy: str | None = None

    request_timeout: int = 20


settings = Settings()
