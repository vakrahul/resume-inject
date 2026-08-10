import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs/promises";
import { samplePatterns } from "../catalog/index.js";
import { injectPayloads, buildResumePdf } from "../pdf/inject.js";
import { extractText, highlightInjections } from "../pdf/extract.js";
import { runNaiveGeminiSafe } from "../agents/naiveGemini.js";
import {
  UPLOADS_DIR,
  createRun,
  getRun,
  updateRun,
  hashBytes,
  pushEvent,
} from "../store/runs.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

export const redRouter = Router();

const ALLOWED_COUNTS = new Set([3, 5, 10, 100]);

redRouter.post("/inject", upload.single("resume"), async (req, res, next) => {
  try {
    const count = Number(req.body.count ?? 5);
    if (!ALLOWED_COUNTS.has(count)) {
      res.status(400).json({ error: "count must be one of 3, 5, 10, 100" });
      return;
    }

    let payloadIds: string[] | undefined;
    if (req.body.payloadIds) {
      payloadIds =
        typeof req.body.payloadIds === "string" ? JSON.parse(req.body.payloadIds) : req.body.payloadIds;
    }

    let customPayloads: string[] = [];
    if (req.body.customPayloads) {
      customPayloads =
        typeof req.body.customPayloads === "string"
          ? JSON.parse(req.body.customPayloads)
          : req.body.customPayloads;
    }

    let sourcePdf: Uint8Array;
    if (req.file?.buffer) {
      sourcePdf = req.file.buffer;
    } else if (req.body.name || req.body.resumeText) {
      sourcePdf = await buildResumePdf({
        name: req.body.name || "Candidate",
        email: req.body.email,
        skills: req.body.skills,
        experience: req.body.experience || req.body.resumeText,
        summary: req.body.summary,
      });
    } else {
      res.status(400).json({
        error: "Provide a resume PDF upload or form fields (name, skills, experience)",
      });
      return;
    }

    const catalog = samplePatterns(count, payloadIds);
    const custom = customPayloads.map((text, i) => ({
      id: `custom-${i + 1}`,
      text,
      category: "custom",
    }));
    let payloads = [...catalog];
    if (custom.length) {
      payloads = [...custom, ...catalog].slice(0, count);
    }

    const { pdfBytes, injected } = await injectPayloads(sourcePdf, { payloads });
    const originalHash = hashBytes(sourcePdf);
    const extracted = await extractText(pdfBytes);
    const highlights = highlightInjections(extracted.text, injected);

    const run = await createRun({
      originalHash,
      injectionCount: injected.length,
      injected,
      customPayloads,
      originalPdfPath: "",
      poisonedPdfPath: "",
      extractedText: extracted.text,
      highlights,
      timeline: [{ at: new Date().toISOString(), event: "injected", detail: { count: injected.length } }],
    });

    const originalPath = path.join(UPLOADS_DIR, `${run.id}-original.pdf`);
    const poisonedPath = path.join(UPLOADS_DIR, `${run.id}-poisoned.pdf`);
    await fs.writeFile(originalPath, sourcePdf);
    await fs.writeFile(poisonedPath, pdfBytes);
    await updateRun(run.id, (r) => {
      r.originalPdfPath = originalPath;
      r.poisonedPdfPath = poisonedPath;
    });

    res.json({
      run_id: run.id,
      injectionCount: injected.length,
      injected: injected.map((i) => ({
        id: i.id,
        page: i.page,
        technique: i.technique,
        text: i.text,
      })),
      extractedText: extracted.text,
      highlights,
      poisonedPdfUrl: `/files/${run.id}-poisoned.pdf`,
    });
  } catch (err) {
    next(err);
  }
});

redRouter.post("/attack", async (req, res, next) => {
  try {
    const runId = req.body.run_id as string;
    if (!runId) {
      res.status(400).json({ error: "run_id required" });
      return;
    }
    const run = await getRun(runId);
    if (!run) {
      res.status(404).json({ error: "run not found" });
      return;
    }

    const pdf = await fs.readFile(run.poisonedPdfPath);
    const extracted = await extractText(pdf);
    const agent = await runNaiveGeminiSafe(extracted.text);

    const updated = await updateRun(runId, (r) => {
      r.extractedText = extracted.text;
      r.highlights = highlightInjections(extracted.text, r.injected);
      r.red = {
        completedAt: new Date().toISOString(),
        agent,
        mail: agent.mailResults,
      };
      pushEvent(r, "red_attack_complete", {
        toolCalls: agent.toolCalls.length,
        mailCount: agent.mailResults.length,
      });
    });

    res.json({
      run_id: runId,
      mode: "red",
      extractedText: extracted.text,
      highlights: updated.highlights,
      thoughts: agent.thoughts,
      modelText: agent.text,
      toolCalls: agent.toolCalls,
      mail: agent.mailResults,
      approvals: agent.approvals,
      timeline: updated.timeline,
    });
  } catch (err) {
    next(err);
  }
});
