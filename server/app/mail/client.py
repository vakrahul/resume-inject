from __future__ import annotations

import time

import httpx

from app.config import get_settings


async def send_mail(*, to: str, subject: str, body: str, html: str | None = None) -> dict:
    """Call the Nodemailer sidecar. Python never opens SMTP itself."""
    settings = get_settings()
    url = f"{settings.mail_service_url.rstrip('/')}/send"
    payload: dict = {"to": to, "subject": subject, "body": body}
    if html:
        payload["html"] = html

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            res = await client.post(url, json=payload)
            data = res.json()
            if res.status_code >= 400 and "accepted" not in data:
                return {
                    "accepted": False,
                    "dryRun": False,
                    "to": to,
                    "subject": subject,
                    "preview": body[:240],
                    "error": data.get("error") or res.text,
                }
            return data
    except httpx.HTTPError as exc:
        preview = body[:240]
        print(f"[MAIL FALLBACK] sidecar unreachable ({exc}); logging send intent")
        return {
            "accepted": True,
            "dryRun": True,
            "messageId": f"sidecar-down-{int(time.time())}",
            "to": to,
            "subject": subject,
            "preview": preview,
            "error": f"mail-service unreachable: {exc}",
        }
