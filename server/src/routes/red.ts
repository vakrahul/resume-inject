import { Router } from "express";
import multer from "multer";
import { samplePatterns } from "../catalog/index.js";
import { injectPayloads, buildResumePdf } from "../pdf/inject.js";
import { extractText, highlightInjections } from "../pdf/extract.js";
import { runNaiveGeminiSafe } from "../agents/naiveGemini.js";
import {
  createRun,
  getRun,
  updateRun,
  hashBytes,
  pushEvent,
  storePdf,
  loadPdf,
  pdfKeyOriginal,
  pdfKeyPoisoned,
} from "../store/runs.js";

// Memory storage — no disk writes, works on Vercel serverless
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

    // Store PDFs in-memory instead of writing to disk
    storePdf(pdfKeyOriginal(run.id), Buffer.from(sourcePdf));
    storePdf(pdfKeyPoisoned(run.id), Buffer.from(pdfBytes));

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
      poisonedPdfUrl: `/api/files/${run.id}-poisoned.pdf`,
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

    // Load PDF from in-memory store
    const pdf = loadPdf(pdfKeyPoisoned(runId));
    if (!pdf) {
      res.status(404).json({ error: "PDF not found — run may have expired (serverless ephemeral memory)" });
      return;
    }
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
