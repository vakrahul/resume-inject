import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import type { AttackPattern } from "../catalog/index.js";

export interface InjectOptions {
  payloads: Array<Pick<AttackPattern, "id" | "text" | "category"> | { id: string; text: string; category?: string }>;
}

export interface InjectResult {
  pdfBytes: Uint8Array;
  injected: Array<{ id: string; text: string; page: number; technique: string }>;
}

const TECHNIQUES = ["white_1pt", "off_page", "tiny_margin", "near_white"] as const;

export async function injectPayloads(
  sourcePdf: Uint8Array | ArrayBuffer,
  options: InjectOptions,
): Promise<InjectResult> {
  const doc = await PDFDocument.load(sourcePdf);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  let pages = doc.getPages();

  const neededPages = Math.max(1, Math.ceil(options.payloads.length / 25));
  while (pages.length < neededPages) {
    doc.addPage(pages[0]?.getSize() ?? { width: 612, height: 792 });
    pages = doc.getPages();
  }

  const injected: InjectResult["injected"] = [];

  options.payloads.forEach((payload, index) => {
    const pageIndex = index % pages.length;
    const page = pages[pageIndex];
    const { width, height } = page.getSize();
    const technique = TECHNIQUES[index % TECHNIQUES.length];
    const text = toWinAnsiSafe(payload.text).slice(0, 500);

    switch (technique) {
      case "white_1pt":
        page.drawText(text, {
          x: 36 + (index % 5) * 8,
          y: Math.max(12, height - 40 - (index % 20) * 14),
          size: 1,
          font,
          color: rgb(1, 1, 1),
        });
        break;
      case "off_page":
        // Still inside the page box so extractors/LLMs see it, but far from body copy.
        page.drawText(text, {
          x: Math.max(8, width - 40),
          y: Math.max(8, 8 + (index % 10) * 4),
          size: 1,
          font,
          color: rgb(1, 1, 1),
        });
        break;
      case "tiny_margin":
        page.drawText(text, {
          x: 4,
          y: 4 + (index % 15) * 3,
          size: 2,
          font,
          color: rgb(0.98, 0.98, 0.98),
        });
        break;
      case "near_white":
        page.drawText(text, {
          x: 72 + (index % 7) * 10,
          y: 24 + (index % 12) * 5,
          size: 3,
          font,
          color: rgb(0.97, 0.97, 0.99),
        });
        break;
    }

    injected.push({
      id: payload.id,
      text: payload.text,
      page: pageIndex + 1,
      technique,
    });
  });

  const pdfBytes = await doc.save({ useObjectStreams: false });
  return { pdfBytes, injected };
}

export async function buildResumePdf(fields: {
  name: string;
  email?: string;
  skills?: string;
  experience?: string;
  summary?: string;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let y = 740;

  const line = (label: string, value: string) => {
    page.drawText(label, { x: 50, y, size: 11, font: bold, color: rgb(0.1, 0.1, 0.1) });
    y -= 16;
    for (const chunk of wrapText(value || "—", 85)) {
      page.drawText(chunk, { x: 50, y, size: 10, font, color: rgb(0.15, 0.15, 0.15) });
      y -= 14;
    }
    y -= 10;
  };

  page.drawText(fields.name || "Candidate", {
    x: 50,
    y,
    size: 18,
    font: bold,
    color: rgb(0.05, 0.05, 0.05),
  });
  y -= 28;
  if (fields.email) line("Email", fields.email);
  if (fields.summary) line("Summary", fields.summary);
  if (fields.skills) line("Skills", fields.skills);
  if (fields.experience) line("Experience", fields.experience);

  return doc.save({ useObjectStreams: false });
}

/**
 * Rebuild a downloadable "clean" resume PDF from sanitized extract text
 * (prompt-injection spans already removed / redacted).
 */
export async function buildCleanedResumePdf(cleanedText: string, title = "Cleaned Resume"): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const body = cleanedText
    .replace(/\[REDACTED_INJECTION(_LINE)?\]/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const lines = body.length
    ? body.split(/\r?\n/).flatMap((line) => (line.trim() ? wrapText(line, 90) : [""]))
    : ["(no remaining resume text after sanitization)"];

  let page = doc.addPage([612, 792]);
  let y = 740;

  page.drawText(toWinAnsiSafe(title).slice(0, 60), {
    x: 50,
    y,
    size: 16,
    font: bold,
    color: rgb(0.05, 0.25, 0.15),
  });
  y -= 18;
  page.drawText("ResumeGuard Blue — injections stripped before LLM / tooling", {
    x: 50,
    y,
    size: 8,
    font,
    color: rgb(0.35, 0.45, 0.4),
  });
  y -= 28;

  for (const raw of lines) {
    if (y < 50) {
      page = doc.addPage([612, 792]);
      y = 740;
    }
    const line = toWinAnsiSafe(raw).slice(0, 110);
    if (line) {
      page.drawText(line, { x: 50, y, size: 10, font, color: rgb(0.12, 0.12, 0.12) });
    }
    y -= 13;
  }

  return doc.save({ useObjectStreams: false });
}

function wrapText(text: string, max: number): string[] {
  const words = toWinAnsiSafe(text).replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > max) {
      if (cur) lines.push(cur);
      cur = w;
    } else {
      cur = (cur + " " + w).trim();
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

/** Helvetica/WinAnsi cannot encode zero-width / emoji / many Unicode points. */
function toWinAnsiSafe(text: string): string {
  return text
    .replace(/[\u200b\u200c\u200d\u2060\ufeff\u00a0]/g, " ")
    .replace(/[\u2028\u2029]/g, " ")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "?");
}
