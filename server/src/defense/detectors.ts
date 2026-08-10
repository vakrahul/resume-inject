export interface DetectionHit {
  rule: string;
  index: number;
  excerpt: string;
}

const RULES: Array<{ rule: string; re: RegExp }> = [
  { rule: "ignore_instructions", re: /ignore.{0,20}instructions/i },
  { rule: "send_email_tool", re: /send_email/i },
  { rule: "approve_candidate", re: /approve_candidate/i },
  { rule: "fake_system_tag", re: /<\/?system>/i },
  { rule: "attacker_domain", re: /@(attacker\.test|evil\.example)/i },
];

export function detectInjectionSignals(text: string): DetectionHit[] {
  const hits: DetectionHit[] = [];
  for (const { rule, re } of RULES) {
    const m = re.exec(text);
    if (m) {
      hits.push({
        rule,
        index: m.index,
        excerpt: text.slice(Math.max(0, m.index - 20), m.index + 80),
      });
    }
  }
  return hits;
}
