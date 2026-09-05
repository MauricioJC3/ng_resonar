"""Shared fixtures: point the history service at a throwaway data dir."""

import pytest

from app.services import history


@pytest.fixture(autouse=True)
def tmp_history(tmp_path, monkeypatch):
    # `_FILE` is bound at import time, so both it and the setting need patching.
    monkeypatch.setattr(history.settings, "data_dir", str(tmp_path))
    monkeypatch.setattr(history, "_FILE", str(tmp_path / "history.json"))
    yield tmp_path
