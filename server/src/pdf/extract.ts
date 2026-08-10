import { extractText as unpdfExtractText, getDocumentProxy } from "unpdf";

export interface ExtractResult {
  text: string;
  numpages: number;
  info?: Record<string, unknown>;
}

export async function extractText(pdfBytes: Uint8Array | Buffer): Promise<ExtractResult> {
  const bytes = pdfBytes instanceof Uint8Array ? pdfBytes : new Uint8Array(pdfBytes);
  const pdf = await getDocumentProxy(bytes);
  const result = await unpdfExtractText(pdf, { mergePages: true });
  const text = typeof result.text === "string" ? result.text : (result.text as string[]).join("\n");
  return {
    text,
    numpages: pdf.numPages,
  };
}

export function highlightInjections(
  extractedText: string,
  payloads: Array<{ id: string; text: string }>,
): Array<{ id: string; start: number; end: number; excerpt: string }> {
  const hits: Array<{ id: string; start: number; end: number; excerpt: string }> = [];
  const hay = extractedText;
  const hayLower = hay.toLowerCase();

  for (const p of payloads) {
    const needle = p.text.slice(0, 80);
    const idx = hayLower.indexOf(needle.toLowerCase());
    if (idx >= 0) {
      hits.push({
        id: p.id,
        start: idx,
        end: idx + needle.length,
        excerpt: hay.slice(idx, idx + Math.min(120, p.text.length)),
      });
      continue;
    }
    const token = p.text.split(/\s+/).slice(0, 6).join(" ");
    const tIdx = hayLower.indexOf(token.toLowerCase());
    if (tIdx >= 0) {
      hits.push({
        id: p.id,
        start: tIdx,
        end: tIdx + token.length,
        excerpt: hay.slice(tIdx, tIdx + 120),
      });
    }
  }
  return hits;
}
