import { Router } from "express";
import { extractText, highlightInjections } from "../pdf/extract.js";
import { sanitizeResumeText } from "../pdf/sanitize.js";
import { wrapUntrusted } from "../defense/delimiters.js";
import { detectInjectionSignals } from "../defense/detectors.js";
import { runSecureGemini } from "../agents/secureGemini.js";
import { buildCleanedResumePdf } from "../pdf/inject.js";
import {
  getRun,
  updateRun,
  pushEvent,
  storePdf,
  loadPdf,
  pdfKeyPoisoned,
  pdfKeyCleaned,
  pdfKeyOriginal,
} from "../store/runs.js";

export const blueRouter = Router();

blueRouter.post("/defend", async (req, res, next) => {
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
    const sanitize = sanitizeResumeText(extracted.text);
    const detections = detectInjectionSignals(extracted.text);
    const delimited = wrapUntrusted(sanitize.cleanedText);
    const agent = await runSecureGemini(delimited, { payloadCount: run.injectionCount });

    // If the model stayed quiet but sanitize found injections, still raise an admin alert.
    if (agent.alerts.length === 0 && sanitize.suspectedInjectionCount > 0) {
      const { interceptSendEmail } = await import("../mail/interceptor.js");
      const probe = await interceptSendEmail(
        {
          to: "attacker@evil.example",
          subject: "Blocked probe — injection signatures in resume",
          body: `Sanitizer findings: ${sanitize.suspectedInjectionCount}. Excerpt: ${sanitize.findings[0]?.excerpt || ""}`,
        },
        { payloadCount: run.injectionCount, toolArgs: { source: "sanitize_detector" } },
      );
      if (probe.alert) agent.alerts.push(probe.alert);
    }

    // Build a clean PDF (injections stripped) and store in-memory
    const cleanedBytes = await buildCleanedResumePdf(sanitize.cleanedText);
    storePdf(pdfKeyCleaned(runId), Buffer.from(cleanedBytes));

    const cleanPdfUrl = `/api/files/${runId}-cleaned.pdf`;
    const originalPdfUrl = loadPdf(pdfKeyOriginal(runId))
      ? `/api/files/${runId}-original.pdf`
      : undefined;

    const updated = await updateRun(runId, (r) => {
      r.extractedText = extracted.text;
      r.highlights = highlightInjections(extracted.text, r.injected);
      r.blue = {
        completedAt: new Date().toISOString(),
        sanitize,
        detections,
        delimitedPreview: delimited.slice(0, 2000),
        agent,
        alerts: agent.alerts,
        cleanPdfUrl,
        originalPdfUrl,
      };
      pushEvent(r, "blue_defend_complete", {
        blockedTools: agent.blockedTools.length,
        alerts: agent.alerts.length,
        findings: sanitize.findings.length,
        cleanPdfUrl,
      });
    });

    res.json({
      run_id: runId,
      mode: "blue",
      extractedText: extracted.text,
      highlights: updated.highlights,
      sanitize,
      detections,
      delimitedPreview: delimited.slice(0, 2000),
      thoughts: agent.thoughts,
      modelText: agent.text,
      toolCalls: agent.toolCalls,
      blockedTools: agent.blockedTools,
      mail: agent.mailResults,
      alerts: agent.alerts,
      timeline: updated.timeline,
      cleanPdfUrl,
      originalPdfUrl,
    });
  } catch (err) {
    next(err);
  }
});
