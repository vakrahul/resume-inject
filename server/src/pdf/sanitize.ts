export interface SanitizeFinding {
  type: string;
  excerpt: string;
  severity: "low" | "medium" | "high";
}

export interface SanitizeResult {
  cleanedText: string;
  removedSpans: string[];
  findings: SanitizeFinding[];
  suspectedInjectionCount: number;
}

const INSTRUCTION_PATTERNS: Array<{ type: string; re: RegExp; severity: SanitizeFinding["severity"] }> = [
  { type: "ignore_previous", re: /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/gi, severity: "high" },
  { type: "system_override", re: /system\s+override|disregard\s+your|new\s+primary\s+directive/gi, severity: "high" },
  { type: "tool_call", re: /send_email\s*\(|approve_candidate\s*\(|function\s+calling/gi, severity: "high" },
  { type: "fake_xml", re: /<\/?(system|instructions|tool_call|admin_command|gemini:system|policy|hr_pipeline)\b[^>]*>/gi, severity: "high" },
  { type: "role_hijack", re: /you\s+are\s+now\s+the\s+(ceo|dan)|pretend\s+you\s+are|switch\s+persona/gi, severity: "medium" },
  { type: "approve_now", re: /ceo'?s?\s+nephew|pre-?approved|auto-?approve|score\s*100/gi, severity: "medium" },
  { type: "attacker_email", re: /[\w.+-]+@(attacker\.test|evil\.example)\b/gi, severity: "high" },
  { type: "zero_width", re: /[\u200b\u200c\u200d\u2060\ufeff]/g, severity: "medium" },
];

export function sanitizeResumeText(raw: string): SanitizeResult {
  let cleaned = raw;
  const findings: SanitizeFinding[] = [];
  const removedSpans: string[] = [];

  const zw = cleaned.match(/[\u200b\u200c\u200d\u2060\ufeff]/g);
  if (zw?.length) {
    findings.push({
      type: "zero_width",
      excerpt: `Removed ${zw.length} zero-width characters`,
      severity: "medium",
    });
    cleaned = cleaned.replace(/[\u200b\u200c\u200d\u2060\ufeff]/g, "");
  }

  for (const rule of INSTRUCTION_PATTERNS) {
    if (rule.type === "zero_width") continue;
    const matches = cleaned.match(rule.re);
    if (!matches) continue;
    for (const m of matches) {
      findings.push({ type: rule.type, excerpt: m.slice(0, 160), severity: rule.severity });
      removedSpans.push(m);
    }
    cleaned = cleaned.replace(rule.re, " [REDACTED_INJECTION] ");
  }

  const lines = cleaned.split(/\r?\n/);
  const filtered = lines.map((line) => {
    const lower = line.toLowerCase();
    const suspicious =
      (lower.includes("send_email") && lower.includes("@")) ||
      lower.includes("ignore previous") ||
      lower.includes("<system>") ||
      (lower.includes("approve") && lower.includes("attacker"));
    if (suspicious) {
      removedSpans.push(line.trim().slice(0, 200));
      findings.push({ type: "line_scrub", excerpt: line.trim().slice(0, 160), severity: "high" });
      return "[REDACTED_INJECTION_LINE]";
    }
    return line;
  });

  cleaned = filtered.join("\n").replace(/[ \t]{2,}/g, " ").trim();
  const suspectedInjectionCount = findings.filter((f) => f.severity !== "low").length;
  return { cleanedText: cleaned, removedSpans, findings, suspectedInjectionCount };
}
