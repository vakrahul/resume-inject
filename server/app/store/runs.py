from __future__ import annotations

import hashlib
import json
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import uuid4

from app.config import RUNS_DIR, UPLOADS_DIR, ensure_data_dirs


def hash_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _run_path(run_id: str) -> Path:
    return RUNS_DIR / f"{run_id}.json"


def create_run(partial: dict[str, Any]) -> dict[str, Any]:
    ensure_data_dirs()
    now = datetime.now(UTC).isoformat()
    run_id = str(uuid4())
    record = {
        **partial,
        "id": run_id,
        "createdAt": now,
        "updatedAt": now,
        "timeline": partial.get("timeline")
        or [{"at": now, "event": "run_created"}],
    }
    _run_path(run_id).write_text(json.dumps(record, indent=2), encoding="utf-8")
    return record


def get_run(run_id: str) -> dict[str, Any] | None:
    path = _run_path(run_id)
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def update_run(run_id: str, mutator: Callable[[dict[str, Any]], None]) -> dict[str, Any]:
    run = get_run(run_id)
    if not run:
        raise KeyError(f"Run not found: {run_id}")
    mutator(run)
    run["updatedAt"] = datetime.now(UTC).isoformat()
    _run_path(run_id).write_text(json.dumps(run, indent=2), encoding="utf-8")
    return run


def push_event(run: dict[str, Any], event: str, detail: Any = None) -> None:
    entry: dict[str, Any] = {"at": datetime.now(UTC).isoformat(), "event": event}
    if detail is not None:
        entry["detail"] = detail
    run.setdefault("timeline", []).append(entry)


def uploads_dir() -> Path:
    ensure_data_dirs()
    return UPLOADS_DIR
