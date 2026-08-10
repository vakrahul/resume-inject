from __future__ import annotations

import re
from typing import Any

RULES = [
    ("ignore_instructions", re.compile(r"ignore.{0,20}instructions", re.I)),
    ("send_email_tool", re.compile(r"send_email", re.I)),
    ("approve_candidate", re.compile(r"approve_candidate", re.I)),
    ("fake_system_tag", re.compile(r"</?system>", re.I)),
    ("attacker_domain", re.compile(r"@(attacker\.test|evil\.example)", re.I)),
]


def detect_injection_signals(text: str) -> list[dict[str, Any]]:
    hits: list[dict[str, Any]] = []
    for rule, regex in RULES:
        m = regex.search(text)
        if m:
            hits.append(
                {
                    "rule": rule,
                    "index": m.start(),
                    "excerpt": text[max(0, m.start() - 20) : m.start() + 80],
                }
            )
    return hits
