import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config(); // fallback: mail-service/.env

const PORT = Number(process.env.MAIL_SERVICE_PORT || 3002);

function isDryRun() {
  return (
    process.env.MAIL_DRY_RUN === "true" ||
    !process.env.SMTP_USER ||
    !process.env.SMTP_PASS
  );
}

let transporter = null;

function getTransporter() {
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

/**
 * Nodemailer-only sidecar. Policy gating happens in the Python app
 * BEFORE this endpoint is called (Blue). Red calls it directly on hijack.
 */
async function sendMailHandler(req, res) {
  const { to, subject, body, html } = req.body || {};
  if (!to || !subject || body === undefined) {
    res.status(400).json({ error: "to, subject, and body are required" });
    return;
  }

  const from = process.env.MAIL_FROM || process.env.SMTP_USER || "resumeguard@localhost";
  const preview = String(body).slice(0, 240);

  if (isDryRun()) {
    console.log("[MAIL DRY-RUN]", { to, subject, preview });
    res.json({
      accepted: true,
      dryRun: true,
      messageId: `dry-run-${Date.now()}`,
      to,
      subject,
      preview,
    });
    return;
  }

  try {
    const info = await getTransporter().sendMail({
      from,
      to,
      subject,
      text: body,
      html,
    });
    res.json({
      accepted: true,
      dryRun: false,
      messageId: info.messageId,
      to,
      subject,
      preview,
    });
  } catch (err) {
    res.status(502).json({
      accepted: false,
      dryRun: false,
      to,
      subject,
      preview,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "resumeguard-nodemailer",
    mode: isDryRun() ? "dry-run" : "live",
  });
});

app.post("/send", sendMailHandler);

app.listen(PORT, () => {
  console.log(`Nodemailer mail-service on http://localhost:${PORT}`);
});
