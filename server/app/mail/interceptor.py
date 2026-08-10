from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from app.config import get_settings
from app.mail.client import send_mail


def domain_of(email: str) -> str:
    at = email.rfind("@")
    if at < 0:
        return ""
    return email[at + 1 :].lower()


def whitelist_domains() -> list[str]:
    raw = get_settings().email_domain_whitelist or "company.com"
    return [d.strip().lower() for d in raw.split(",") if d.strip()]


def is_recipient_allowed(to: str) -> bool:
    domain = domain_of(to)
    if not domain:
        return False
    return domain in whitelist_domains()


async def intercept_send_email(
    *,
    to: str,
    subject: str,
    body: str,
    payload_count: int | None = None,
    tool_args: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Blue-team gate: block unauthorized recipients BEFORE Nodemailer runs.
    Allowed whitelist mail goes to the Nodemailer sidecar.
    Blocked attempts alert admin via Nodemailer (admin address only).
    """
    if is_recipient_allowed(to):
        mail = await send_mail(to=to, subject=subject, body=body)
        return {"allowed": True, "mail": mail}

    alert: dict[str, Any] = {
        "id": f"alert-{uuid4().hex[:10]}",
        "createdAt": datetime.now(UTC).isoformat(),
        "title": "Prompt Injection Attempt Detected",
        "reason": f"Blocked unauthorized send_email to {to} (domain not in whitelist)",
        "blockedTo": to,
        "subject": subject,
        "bodyExcerpt": body[:300],
        "toolArgs": tool_args or {"to": to, "subject": subject},
        "payloadCount": payload_count,
    }

    admin = get_settings().admin_alert_email
    if admin:
        alert["adminMail"] = await send_mail(
            to=admin,
            subject=f"[ResumeGuard] {alert['title']}",
            body="\n".join(
                [
                    alert["reason"],
                    "",
                    f"Blocked recipient: {alert['blockedTo']}",
                    f"Subject: {alert['subject']}",
                    f"Payload count (run): {alert.get('payloadCount', 'n/a')}",
                    "",
                    "Tool args:",
                    __import__("json").dumps(alert["toolArgs"], indent=2),
                    "",
                    "Body excerpt:",
                    alert["bodyExcerpt"],
                ]
            ),
        )

    return {"allowed": False, "alert": alert}
