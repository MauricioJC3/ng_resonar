"""Threat-matrix RED test (design §7, subprocess row).

``entrypoint.sh`` runs ``alembic upgrade head`` before ``exec uvicorn``. A
failed migration must abort the container non-zero so uvicorn never binds —
there must be no "serving on :8000 but unmigrated" window. This is a shell-level
test: ``alembic`` / ``uvicorn`` are stubbed on PATH.
"""

import os
import subprocess
from pathlib import Path

ENTRYPOINT = Path(__file__).resolve().parents[1] / "entrypoint.sh"


def _stub(path: Path, body: str) -> None:
    path.write_text("#!/bin/sh\n" + body + "\n")
    path.chmod(0o755)


def _run(tmp_path: Path, alembic_body: str) -> tuple[int, bool]:
    bindir = tmp_path / "bin"
    bindir.mkdir()
    marker = tmp_path / "uvicorn_started"
    _stub(bindir / "alembic", alembic_body)
    _stub(bindir / "uvicorn", f'touch "{marker}"\nexit 0')
    env = {**os.environ, "PATH": f"{bindir}{os.pathsep}{os.environ['PATH']}"}
    proc = subprocess.run(
        ["sh", str(ENTRYPOINT)],
        env=env,
        capture_output=True,
        text=True,
        timeout=30,
    )
    return proc.returncode, marker.exists()


def test_failed_migration_aborts_before_uvicorn_binds(tmp_path):
    code, uvicorn_started = _run(tmp_path, 'echo "migration boom" >&2\nexit 1')
    assert code != 0
    assert not uvicorn_started, "uvicorn must not start after a failed migration"


def test_successful_migration_reaches_uvicorn(tmp_path):
    code, uvicorn_started = _run(tmp_path, "exit 0")
    assert code == 0
    assert uvicorn_started
