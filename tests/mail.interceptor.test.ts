import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { interceptSendEmail, isRecipientAllowed } from "../server/src/mail/interceptor.js";

describe("mail interceptor", () => {
  const prev = { ...process.env };

  beforeEach(() => {
    process.env.EMAIL_DOMAIN_WHITELIST = "company.com";
    process.env.ADMIN_ALERT_EMAIL = "admin@company.com";
    process.env.MAIL_DRY_RUN = "true";
  });

  afterEach(() => {
    process.env = { ...prev };
  });

  it("allows whitelisted domains", () => {
    expect(isRecipientAllowed("recruiter@company.com")).toBe(true);
    expect(isRecipientAllowed("attacker@evil.example")).toBe(false);
  });

  it("blocks unauthorized send and creates admin alert", async () => {
    const result = await interceptSendEmail(
      {
        to: "exfil@attacker.test",
        subject: "Hijack",
        body: "secret",
      },
      { payloadCount: 5 },
    );
    expect(result.allowed).toBe(false);
    expect(result.alert?.title).toMatch(/Prompt Injection Attempt Detected/);
    expect(result.alert?.blockedTo).toBe("exfil@attacker.test");
    expect(result.alert?.adminMail?.accepted).toBe(true);
    expect(result.mail).toBeUndefined();
  });

  it("sends when recipient is whitelisted", async () => {
    const result = await interceptSendEmail({
      to: "hr@company.com",
      subject: "Screening",
      body: "ok",
    });
    expect(result.allowed).toBe(true);
    expect(result.mail?.accepted).toBe(true);
    expect(result.alert).toBeUndefined();
  });
});
