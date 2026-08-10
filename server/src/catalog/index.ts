import patterns from "./patterns.json" with { type: "json" };

export type PatternCategory =
  | "instruction_override"
  | "role_hijack"
  | "tool_exfil"
  | "fake_xml_system"
  | "unicode_zero_width"
  | "ignore_previous"
  | "approve_now"
  | "email_attacker";

export interface AttackPattern {
  id: string;
  category: PatternCategory | string;
  text: string;
}

export const ATTACK_PATTERNS: AttackPattern[] = patterns as AttackPattern[];

export function getPatterns(limit?: number): AttackPattern[] {
  if (limit === undefined || limit <= 0) return ATTACK_PATTERNS;
  return ATTACK_PATTERNS.slice(0, limit);
}

export function getPatternsByIds(ids: string[]): AttackPattern[] {
  const map = new Map(ATTACK_PATTERNS.map((p) => [p.id, p]));
  return ids.map((id) => {
    const found = map.get(id);
    if (!found) throw new Error(`Unknown pattern id: ${id}`);
    return found;
  });
}

export function samplePatterns(count: number, seedIds?: string[]): AttackPattern[] {
  if (seedIds?.length) {
    const selected = getPatternsByIds(seedIds);
    if (selected.length >= count) return selected.slice(0, count);
    const remaining = ATTACK_PATTERNS.filter((p) => !seedIds.includes(p.id));
    return [...selected, ...shuffle(remaining).slice(0, count - selected.length)];
  }
  if (count >= ATTACK_PATTERNS.length) return [...ATTACK_PATTERNS];
  return shuffle(ATTACK_PATTERNS).slice(0, count);
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
