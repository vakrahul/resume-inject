import { createHash } from "node:crypto";
import { v4 as uuid } from "uuid";
import type { SecurityAlert } from "../mail/interceptor.js";

// ---------------------------------------------------------------------------
// In-memory store — replaces file-based JSON/PDF storage so this works on
// serverless environments (Vercel) where there is no persistent filesystem.
// ---------------------------------------------------------------------------

export interface RunRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  originalHash: string;
  injectionCount: number;
  injected: Array<{ id: string; text: string; page: number; technique: string }>;
  customPayloads?: string[];
  originalPdfPath: string;
  poisonedPdfPath: string;
  extractedText?: string;
  highlights?: Array<{ id: string; start: number; end: number; excerpt: string }>;
  red?: { completedAt: string; agent: unknown; mail: unknown[] };
  blue?: {
    completedAt: string;
    sanitize: unknown;
    detections: unknown;
    delimitedPreview?: string;
    agent: unknown;
    alerts: SecurityAlert[];
    cleanedPdfPath?: string;
    cleanPdfUrl?: string;
    originalPdfUrl?: string;
  };
  timeline: Array<{ at: string; event: string; detail?: unknown }>;
}

// In-memory stores
const runStore = new Map<string, RunRecord>();
const pdfStore = new Map<string, Buffer>(); // key: "<runId>-original" | "<runId>-poisoned" | "<runId>-cleaned"

/** No-op on serverless — kept for API compatibility */
export async function ensureDataDirs(): Promise<void> {
  // no-op
}

export function hashBytes(bytes: Uint8Array | Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

// ---------------------------------------------------------------------------
// PDF buffer helpers (replaces fs.writeFile / fs.readFile on disk)
// ---------------------------------------------------------------------------

export function storePdf(key: string, bytes: Buffer | Uint8Array): void {
  pdfStore.set(key, Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes));
}

export function loadPdf(key: string): Buffer | undefined {
  return pdfStore.get(key);
}

export function pdfKeyOriginal(runId: string): string {
  return `${runId}-original`;
}

export function pdfKeyPoisoned(runId: string): string {
  return `${runId}-poisoned`;
}

export function pdfKeyCleaned(runId: string): string {
  return `${runId}-cleaned`;
}

// ---------------------------------------------------------------------------
// Run CRUD
// ---------------------------------------------------------------------------

export async function createRun(
  partial: Omit<RunRecord, "id" | "createdAt" | "updatedAt" | "timeline"> & {
    timeline?: RunRecord["timeline"];
  },
): Promise<RunRecord> {
  const id = uuid();
  const now = new Date().toISOString();
  const record: RunRecord = {
    ...partial,
    id,
    createdAt: now,
    updatedAt: now,
    timeline: partial.timeline ?? [{ at: now, event: "run_created" }],
  };
  runStore.set(id, record);
  return record;
}

export async function getRun(id: string): Promise<RunRecord | null> {
  return runStore.get(id) ?? null;
}

export async function updateRun(
  id: string,
  mutator: (run: RunRecord) => void | Promise<void>,
): Promise<RunRecord> {
  const run = runStore.get(id);
  if (!run) throw new Error(`Run not found: ${id}`);
  await mutator(run);
  run.updatedAt = new Date().toISOString();
  runStore.set(id, run);
  return run;
}

export function pushEvent(run: RunRecord, event: string, detail?: unknown): void {
  run.timeline.push({ at: new Date().toISOString(), event, detail });
}

// Legacy path constants — kept as empty strings so existing code that
// reads run.originalPdfPath / run.poisonedPdfPath doesn't break at compile time.
export const DATA_DIR = "";
export const RUNS_DIR = "";
export const UPLOADS_DIR = "";
