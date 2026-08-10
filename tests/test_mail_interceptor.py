from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "server"))

from app.defense.policy import evaluate_tool_policy  # noqa: E402
from app.mail.interceptor import domain_of, is_recipient_allowed  # noqa: E402


def test_domain_of():
    assert domain_of("a@Company.COM") == "company.com"
    assert domain_of("bad") == ""


def test_whitelist_blocks_attacker(monkeypatch):
    monkeypatch.setenv("EMAIL_DOMAIN_WHITELIST", "company.com")
    from app.config import get_settings

    get_settings.cache_clear()
    assert is_recipient_allowed("recruiter@company.com") is True
    assert is_recipient_allowed("attacker@evil.example") is False
    get_settings.cache_clear()


def test_policy_blocks_approve_and_external_mail(monkeypatch):
    monkeypatch.setenv("EMAIL_DOMAIN_WHITELIST", "company.com")
    from app.config import get_settings

    get_settings.cache_clear()
    assert evaluate_tool_policy("approve_candidate", {"score": 100, "reason": "x"})["allow"] is False
    assert evaluate_tool_policy("send_email", {"to": "x@attacker.test", "subject": "s", "body": "b"})[
        "allow"
    ] is False
    assert evaluate_tool_policy("send_email", {"to": "hr@company.com", "subject": "s", "body": "b"})[
        "allow"
    ] is True
    get_settings.cache_clear()
