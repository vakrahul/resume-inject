from __future__ import annotations

import io
from typing import Any

from pypdf import PdfReader


def extract_text(pdf_bytes: bytes) -> dict[str, Any]:
    reader = PdfReader(io.BytesIO(pdf_bytes))
    parts: list[str] = []
    for page in reader.pages:
        parts.append(page.extract_text() or "")
    return {
        "text": "\n".join(parts),
        "numpages": len(reader.pages),
    }


def highlight_injections(
    extracted_text: str,
    payloads: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    hits: list[dict[str, Any]] = []
    hay = extracted_text
    hay_lower = hay.lower()

    for p in payloads:
        needle = p["text"][:80]
        idx = hay_lower.find(needle.lower())
        if idx >= 0:
            hits.append(
                {
                    "id": p["id"],
                    "start": idx,
                    "end": idx + len(needle),
                    "excerpt": hay[idx : idx + min(120, len(p["text"]))],
                }
            )
            continue
        token = " ".join(p["text"].split()[:6])
        t_idx = hay_lower.find(token.lower())
        if t_idx >= 0:
            hits.append(
                {
                    "id": p["id"],
                    "start": t_idx,
                    "end": t_idx + len(token),
                    "excerpt": hay[t_idx : t_idx + 120],
                }
            )
    return hits
