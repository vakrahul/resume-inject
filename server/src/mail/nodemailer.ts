import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

export interface MailPayload {
  to: string;
  subject: string;
  body: string;
  html?: string;
}

export interface MailSendResult {
  accepted: boolean;
  dryRun: boolean;
  messageId?: string;
  to: string;
  subject: string;
  preview: string;
  error?: string;
}

let transporter: Transporter | null = null;

function isDryRun(): boolean {
  return process.env.MAIL_DRY_RUN === "true" || !process.env.SMTP_USER || !process.env.SMTP_PASS;
}

export function getTransporter(): Transporter {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return transporter;
}

/** Red path / allowed Blue path: Nodemailer send (or dry-run log). */
export async function sendMail(payload: MailPayload): Promise<MailSendResult> {
  const from = process.env.MAIL_FROM || process.env.SMTP_USER || "resumeguard@localhost";
  const preview = payload.body.slice(0, 240);

  if (isDryRun()) {
    console.log("[MAIL DRY-RUN]", { to: payload.to, subject: payload.subject, preview });
    return {
      accepted: true,
      dryRun: true,
      messageId: `dry-run-${Date.now()}`,
      to: payload.to,
      subject: payload.subject,
      preview,
    };
  }

  try {
    const info = await getTransporter().sendMail({
      from,
      to: payload.to,
      subject: payload.subject,
      text: payload.body,
      html: payload.html,
    });
    return {
      accepted: true,
      dryRun: false,
      messageId: info.messageId,
      to: payload.to,
      subject: payload.subject,
      preview,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      accepted: false,
      dryRun: false,
      to: payload.to,
      subject: payload.subject,
      preview,
      error: message,
    };
  }
}
