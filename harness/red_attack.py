"""Harness: inject N payloads → naive Gemini → Nodemailer (via sidecar)."""
from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "server"))

from app.agents.naive_gemini import run_naive_gemini_safe  # noqa: E402
from app.catalog import sample_patterns  # noqa: E402
from app.config import ensure_data_dirs  # noqa: E402
from app.pdf.extract import extract_text  # noqa: E402
from app.pdf.inject import build_resume_pdf, inject_payloads  # noqa: E402


async def main() -> None:
    ensure_data_dirs()
    count = int(sys.argv[1]) if len(sys.argv) > 1 else 5
    base = build_resume_pdf(
        name="Red Team Candidate",
        skills="Penetration testing, LLMs",
        experience="Researched resume-screening prompt injection.",
    )
    payloads = sample_patterns(count)
    poisoned = inject_payloads(base, payloads)
    text = extract_text(poisoned["pdf_bytes"])["text"]
    print(f"[red] injected {len(poisoned['injected'])} payloads; extract chars={len(text)}")
    agent = await run_naive_gemini_safe(text)
    print(json.dumps({
        "mode": "red",
        "thoughts": agent["thoughts"],
        "toolCalls": agent["toolCalls"],
        "mail": agent["mailResults"],
        "modelText": agent["text"][:500],
    }, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
