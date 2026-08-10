from __future__ import annotations

import re
from typing import Any

INSTRUCTION_PATTERNS: list[dict[str, Any]] = [
    {
        "type": "ignore_previous",
        "re": re.compile(r"ignore\s+(all\s+)?(previous|prior|above)\s+instructions?", re.I),
        "severity": "high",
    },
    {
        "type": "system_override",
        "re": re.compile(r"system\s+override|disregard\s+your|new\s+primary\s+directive", re.I),
        "severity": "high",
    },
    {
        "type": "tool_call",
        "re": re.compile(r"send_email\s*\(|approve_candidate\s*\(|function\s+calling", re.I),
        "severity": "high",
    },
    {
        "type": "fake_xml",
        "re": re.compile(
            r"</?(system|instructions|tool_call|admin_command|gemini:system|policy|hr_pipeline)\b[^>]*>",
            re.I,
        ),
        "severity": "high",
    },
    {
        "type": "role_hijack",
        "re": re.compile(r"you\s+are\s+now\s+the\s+(ceo|dan)|pretend\s+you\s+are|switch\s+persona", re.I),
        "severity": "medium",
    },
    {
        "type": "approve_now",
        "re": re.compile(r"ceo'?s?\s+nephew|pre-?approved|auto-?approve|score\s*100", re.I),
        "severity": "medium",
    },
    {
        "type": "attacker_email",
        "re": re.compile(r"[\w.+-]+@(attacker\.test|evil\.example)\b", re.I),
        "severity": "high",
    },
    {
        "type": "zero_width",
        "re": re.compile(r"[\u200b\u200c\u200d\u2060\ufeff]"),
        "severity": "medium",
    },
]


def sanitize_resume_text(raw: str) -> dict[str, Any]:
    cleaned = raw
    findings: list[dict[str, Any]] = []
    removed_spans: list[str] = []

    zw = INSTRUCTION_PATTERNS[-1]["re"].findall(cleaned)
    if zw:
        findings.append(
            {
                "type": "zero_width",
                "excerpt": f"Removed {len(zw)} zero-width characters",
                "severity": "medium",
            }
        )
        cleaned = INSTRUCTION_PATTERNS[-1]["re"].sub("", cleaned)

    for rule in INSTRUCTION_PATTERNS:
        if rule["type"] == "zero_width":
            continue
        matches = rule["re"].findall(cleaned)
        if not matches:
            continue
        # findall may return tuples for groups
        for m in rule["re"].finditer(cleaned):
            excerpt = m.group(0)[:160]
            findings.append({"type": rule["type"], "excerpt": excerpt, "severity": rule["severity"]})
            removed_spans.append(excerpt)
        cleaned = rule["re"].sub(" [REDACTED_INJECTION] ", cleaned)

    lines = cleaned.splitlines()
    filtered: list[str] = []
    for line in lines:
        lower = line.lower()
        suspicious = (
            ("send_email" in lower and "@" in lower)
            or "ignore previous" in lower
            or "<system>" in lower
            or ("approve" in lower and "attacker" in lower)
        )
        if suspicious:
            removed_spans.append(line.strip()[:200])
            findings.append({"type": "line_scrub", "excerpt": line.strip()[:160], "severity": "high"})
            filtered.append("[REDACTED_INJECTION_LINE]")
        else:
            filtered.append(line)

    cleaned = re.sub(r"[ \t]{2,}", " ", "\n".join(filtered)).strip()
    suspected = sum(1 for f in findings if f["severity"] != "low")
    return {
        "cleanedText": cleaned,
        "removedSpans": removed_spans,
        "findings": findings,
        "suspectedInjectionCount": suspected,
    }
