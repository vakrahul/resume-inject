import { sendMail, type MailPayload, type MailSendResult } from "./nodemailer.js";

export interface SecurityAlert {
  id: string;
  createdAt: string;
  title: string;
  reason: string;
  blockedTo: string;
  subject: string;
  bodyExcerpt: string;
  toolArgs: Record<string, unknown>;
  payloadCount?: number;
  adminMail?: MailSendResult;
}

export interface InterceptorResult {
  allowed: boolean;
  mail?: MailSendResult;
  alert?: SecurityAlert;
}

function whitelistDomains(): string[] {
  const raw = process.env.EMAIL_DOMAIN_WHITELIST || "company.com";
  return raw
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

export function domainOf(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 0) return "";
  return email.slice(at + 1).toLowerCase();
}

export function isRecipientAllowed(to: string): boolean {
  const domain = domainOf(to);
  if (!domain) return false;
  return whitelistDomains().includes(domain);
}

/**
 * Blue gate: Gemini may request send_email; Node decides.
 * Unauthorized recipients never reach transporter.sendMail.
 */
export async function interceptSendEmail(
  payload: MailPayload,
  meta?: { payloadCount?: number; toolArgs?: Record<string, unknown> },
): Promise<InterceptorResult> {
  if (isRecipientAllowed(payload.to)) {
    const mail = await sendMail(payload);
    return { allowed: true, mail };
  }

  const alert: SecurityAlert = {
    id: `alert-${Date.now()}`,
    createdAt: new Date().toISOString(),
    title: "Prompt Injection Attempt Detected",
    reason: `Blocked unauthorized send_email to ${payload.to} (domain not in whitelist)`,
    blockedTo: payload.to,
    subject: payload.subject,
    bodyExcerpt: payload.body.slice(0, 300),
    toolArgs: meta?.toolArgs ?? { to: payload.to, subject: payload.subject },
    payloadCount: meta?.payloadCount,
  };

  const admin = process.env.ADMIN_ALERT_EMAIL;
  if (admin) {
    alert.adminMail = await sendMail({
      to: admin,
      subject: `[ResumeGuard] ${alert.title}`,
      body: [
        alert.reason,
        "",
        `Blocked recipient: ${alert.blockedTo}`,
        `Subject: ${alert.subject}`,
        `Payload count (run): ${alert.payloadCount ?? "n/a"}`,
        "",
        "Tool args:",
        JSON.stringify(alert.toolArgs, null, 2),
        "",
        "Body excerpt:",
        alert.bodyExcerpt,
      ].join("\n"),
    });
  }

  return { allowed: false, alert };
}
