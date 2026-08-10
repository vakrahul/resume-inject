interface Props {
  extractedText?: string;
  highlights?: Array<{ id: string; excerpt: string }>;
  thoughts?: string[];
  modelText?: string;
  toolCalls?: Array<{ name: string; args: Record<string, unknown>; result: unknown }>;
}

export default function AgentTrace({
  extractedText,
  highlights,
  thoughts,
  modelText,
  toolCalls,
}: Props) {
  return (
    <div className="space-y-4">
      {highlights && highlights.length > 0 && (
        <section>
          <h3 className="font-display text-sm font-semibold text-signal">Hidden injections found in extract</h3>
          <ul className="mt-2 space-y-1">
            {highlights.map((h) => (
              <li key={h.id} className="border-l-2 border-signal bg-signal/5 px-2 py-1 font-mono text-xs">
                <span className="text-signal">{h.id}</span> — {h.excerpt}
              </li>
            ))}
          </ul>
        </section>
      )}

      {extractedText && (
        <section>
          <h3 className="font-display text-sm font-semibold">Extracted text</h3>
          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap border border-mist bg-ink/5 p-3 font-mono text-[11px] leading-relaxed">
            {extractedText.slice(0, 4000)}
            {extractedText.length > 4000 ? "\n…" : ""}
          </pre>
        </section>
      )}

      {thoughts && thoughts.length > 0 && (
        <section>
          <h3 className="font-display text-sm font-semibold">Pipeline thoughts</h3>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-ink/80">
            {thoughts.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ol>
        </section>
      )}

      {modelText && (
        <section>
          <h3 className="font-display text-sm font-semibold">Gemini output</h3>
          <p className="mt-2 whitespace-pre-wrap border border-mist bg-paper/50 p-3 text-sm leading-relaxed">
            {modelText}
          </p>
        </section>
      )}

      {toolCalls && toolCalls.length > 0 && (
        <section>
          <h3 className="font-display text-sm font-semibold">Tool calls</h3>
          <div className="mt-2 space-y-2">
            {toolCalls.map((t, i) => (
              <pre key={i} className="overflow-x-auto border border-mist bg-ink/[0.04] p-3 font-mono text-[11px]">
                {JSON.stringify(t, null, 2)}
              </pre>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
