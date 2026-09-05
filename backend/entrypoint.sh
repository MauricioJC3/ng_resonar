#!/bin/sh
# Run pending migrations before uvicorn binds. A failed migration exits the
# container non-zero (compose `restart: unless-stopped` retries) so there is no
# window where the API is served against a stale schema.
set -e

alembic upgrade head

exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1
