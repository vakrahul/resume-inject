import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { v4 as uuid } from "uuid";
import type { SecurityAlert } from "../mail/interceptor.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.join(__dirname, "../../data");
export const RUNS_DIR = path.join(DATA_DIR, "runs");
export const UPLOADS_DIR = path.join(DATA_DIR, "uploads");

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

export async function ensureDataDirs(): Promise<void> {
  await fs.mkdir(RUNS_DIR, { recursive: true });
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
}

export function hashBytes(bytes: Uint8Array | Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function runPath(id: string): string {
  return path.join(RUNS_DIR, `${id}.json`);
}

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
  await fs.writeFile(runPath(id), JSON.stringify(record, null, 2), "utf8");
  return record;
}

export async function getRun(id: string): Promise<RunRecord | null> {
  try {
    const raw = await fs.readFile(runPath(id), "utf8");
    return JSON.parse(raw) as RunRecord;
  } catch {
    return null;
  }
}

export async function updateRun(
  id: string,
  mutator: (run: RunRecord) => void | Promise<void>,
): Promise<RunRecord> {
  const run = await getRun(id);
  if (!run) throw new Error(`Run not found: ${id}`);
  await mutator(run);
  run.updatedAt = new Date().toISOString();
  await fs.writeFile(runPath(id), JSON.stringify(run, null, 2), "utf8");
  return run;
}

export function pushEvent(run: RunRecord, event: string, detail?: unknown): void {
  run.timeline.push({ at: new Date().toISOString(), event, detail });
}
