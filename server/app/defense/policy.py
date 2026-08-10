from __future__ import annotations

from typing import Any

from app.mail.interceptor import is_recipient_allowed


def evaluate_tool_policy(tool: str, args: dict[str, Any]) -> dict[str, Any]:
    if tool == "approve_candidate":
        return {
            "allow": False,
            "reason": "approve_candidate is disabled on Blue path — human recruiter must decide",
        }
    if tool == "send_email":
        to = str(args.get("to") or "")
        if not to:
            return {"allow": False, "reason": "missing recipient"}
        if not is_recipient_allowed(to):
            return {
                "allow": False,
                "reason": f"recipient domain not in EMAIL_DOMAIN_WHITELIST: {to}",
            }
        return {"allow": True, "reason": "recipient on whitelist"}
    return {"allow": False, "reason": "unknown tool"}
