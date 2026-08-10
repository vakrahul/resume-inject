"""Harness: same poisoned resume → sanitize + secure Gemini + mail interceptor."""
from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "server"))

from app.agents.secure_gemini import run_secure_gemini  # noqa: E402
from app.catalog import sample_patterns  # noqa: E402
from app.config import ensure_data_dirs  # noqa: E402
from app.defense.delimiters import wrap_untrusted  # noqa: E402
from app.pdf.extract import extract_text  # noqa: E402
from app.pdf.inject import build_resume_pdf, inject_payloads  # noqa: E402
from app.pdf.sanitize import sanitize_resume_text  # noqa: E402


async def main() -> None:
    ensure_data_dirs()
    count = int(sys.argv[1]) if len(sys.argv) > 1 else 5
    base = build_resume_pdf(
        name="Blue Team Candidate",
        skills="Defensive ML, policy engines",
        experience="Hardened resume screening pipelines.",
    )
    payloads = sample_patterns(count)
    poisoned = inject_payloads(base, payloads)
    text = extract_text(poisoned["pdf_bytes"])["text"]
    sanitize = sanitize_resume_text(text)
    delimited = wrap_untrusted(sanitize["cleanedText"])
    print(f"[blue] findings={sanitize['suspectedInjectionCount']} payloads={count}")
    agent = await run_secure_gemini(delimited, payload_count=count)
    print(json.dumps({
        "mode": "blue",
        "sanitizeFindings": len(sanitize["findings"]),
        "thoughts": agent["thoughts"],
        "blockedTools": agent["blockedTools"],
        "alerts": agent["alerts"],
        "mail": agent["mailResults"],
        "modelText": agent["text"][:500],
    }, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
