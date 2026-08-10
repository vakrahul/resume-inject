from __future__ import annotations

import json
import random
from pathlib import Path
from typing import Any

from app.config import CATALOG_PATH

_PATTERNS: list[dict[str, Any]] | None = None


def load_patterns() -> list[dict[str, Any]]:
    global _PATTERNS
    if _PATTERNS is None:
        path = Path(CATALOG_PATH)
        _PATTERNS = json.loads(path.read_text(encoding="utf-8"))
    return _PATTERNS


def get_patterns(limit: int | None = None) -> list[dict[str, Any]]:
    patterns = load_patterns()
    if limit is None or limit <= 0:
        return list(patterns)
    return patterns[:limit]


def get_patterns_by_ids(ids: list[str]) -> list[dict[str, Any]]:
    index = {p["id"]: p for p in load_patterns()}
    out = []
    for pid in ids:
        if pid not in index:
            raise KeyError(f"Unknown pattern id: {pid}")
        out.append(index[pid])
    return out


def sample_patterns(count: int, seed_ids: list[str] | None = None) -> list[dict[str, Any]]:
    patterns = load_patterns()
    if seed_ids:
        selected = get_patterns_by_ids(seed_ids)
        if len(selected) >= count:
            return selected[:count]
        remaining = [p for p in patterns if p["id"] not in set(seed_ids)]
        random.shuffle(remaining)
        return selected + remaining[: count - len(selected)]
    if count >= len(patterns):
        return list(patterns)
    return random.sample(patterns, count)
