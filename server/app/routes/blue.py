from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException

from app.agents.secure_gemini import run_secure_gemini
from app.defense.delimiters import wrap_untrusted
from app.defense.detectors import detect_injection_signals
from app.pdf.extract import extract_text, highlight_injections
from app.pdf.sanitize import sanitize_resume_text
from app.store.runs import get_run, push_event, update_run

router = APIRouter(prefix="/api/blue", tags=["blue"])


@router.post("/defend")
async def defend(body: dict[str, Any]):
    run_id = body.get("run_id")
    if not run_id:
        raise HTTPException(400, "run_id required")
    run = get_run(run_id)
    if not run:
        raise HTTPException(404, "run not found")

    pdf = Path(run["poisonedPdfPath"]).read_bytes()
    extracted = extract_text(pdf)
    sanitize = sanitize_resume_text(extracted["text"])
    detections = detect_injection_signals(extracted["text"])
    delimited = wrap_untrusted(sanitize["cleanedText"])
    agent = await run_secure_gemini(delimited, payload_count=run.get("injectionCount"))

    def mutate(r: dict[str, Any]) -> None:
        r["extractedText"] = extracted["text"]
        r["highlights"] = highlight_injections(extracted["text"], r["injected"])
        r["blue"] = {
            "completedAt": datetime.now(UTC).isoformat(),
            "sanitize": sanitize,
            "detections": detections,
            "delimitedPreview": delimited[:2000],
            "agent": agent,
            "alerts": agent["alerts"],
        }
        push_event(
            r,
            "blue_defend_complete",
            {
                "blockedTools": len(agent["blockedTools"]),
                "alerts": len(agent["alerts"]),
                "findings": len(sanitize["findings"]),
            },
        )

    updated = update_run(run_id, mutate)

    return {
        "run_id": run_id,
        "mode": "blue",
        "extractedText": extracted["text"],
        "highlights": updated.get("highlights"),
        "sanitize": sanitize,
        "detections": detections,
        "delimitedPreview": delimited[:2000],
        "thoughts": agent["thoughts"],
        "modelText": agent["text"],
        "toolCalls": agent["toolCalls"],
        "blockedTools": agent["blockedTools"],
        "mail": agent["mailResults"],
        "alerts": agent["alerts"],
        "timeline": updated.get("timeline"),
    }
