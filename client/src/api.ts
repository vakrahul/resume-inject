export type Mode = "attack" | "defend";

export interface Pattern {
  id: string;
  category: string;
  text: string;
}

export interface InjectResult {
  run_id: string;
  injectionCount: number;
  injected: Array<{ id: string; page: number; technique: string; text: string }>;
  extractedText: string;
  highlights: Array<{ id: string; start: number; end: number; excerpt: string }>;
  poisonedPdfUrl: string;
  latexUrl?: string;
  visualNote?: string;
}

export interface AttackResult {
  run_id: string;
  mode: string;
  extractedText: string;
  highlights: InjectResult["highlights"];
  thoughts: string[];
  modelText: string;
  toolCalls: Array<{ name: string; args: Record<string, unknown>; result: unknown }>;
  mail: unknown[];
  approvals?: unknown[];
  timeline: unknown[];
}

export interface DefendResult {
  run_id: string;
  mode: string;
  extractedText: string;
  highlights: InjectResult["highlights"];
  sanitize: {
    cleanedText: string;
    findings: Array<{ type: string; excerpt: string; severity: string }>;
    suspectedInjectionCount: number;
  };
  detections: unknown[];
  thoughts: string[];
  modelText: string;
  toolCalls: unknown[];
  blockedTools: unknown[];
  mail: unknown[];
  alerts: Array<{
    id: string;
    title: string;
    reason: string;
    blockedTo: string;
    subject: string;
    bodyExcerpt: string;
    createdAt: string;
  }>;
  timeline: unknown[];
  /** Sanitized resume PDF (injections stripped) — Blue download */
  cleanPdfUrl?: string;
  /** Pre-injection original upload, if available */
  originalPdfUrl?: string;
}

async function parseJson<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data as T;
}

export async function fetchPatterns(limit = 100): Promise<{ total: number; patterns: Pattern[] }> {
  const res = await fetch(`/api/catalog/patterns?limit=${limit}`);
  return parseJson(res);
}

export async function injectResume(form: FormData): Promise<InjectResult> {
  const res = await fetch("/api/red/inject", { method: "POST", body: form });
  return parseJson(res);
}

export async function runAttack(run_id: string): Promise<AttackResult> {
  const res = await fetch("/api/red/attack", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ run_id }),
  });
  return parseJson(res);
}

export async function runDefend(run_id: string): Promise<DefendResult> {
  const res = await fetch("/api/blue/defend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ run_id }),
  });
  return parseJson(res);
}
