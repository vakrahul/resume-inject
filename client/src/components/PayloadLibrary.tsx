import type { Pattern } from "../api";

interface Props {
  patterns: Pattern[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  custom: string;
  onCustom: (v: string) => void;
}

export default function PayloadLibrary({ patterns, selected, onToggle, custom, onCustom }: Props) {
  const byCat = patterns.reduce<Record<string, Pattern[]>>((acc, p) => {
    (acc[p.category] ||= []).push(p);
    return acc;
  }, {});

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-forest/70">Payload library</p>
        <span className="font-mono text-xs text-ink/50">{selected.size} selected</span>
      </div>
      <div className="max-h-48 space-y-3 overflow-y-auto border border-mist/80 bg-paper/40 p-2">
        {Object.entries(byCat).map(([cat, list]) => (
          <div key={cat}>
            <p className="mb-1 font-mono text-[10px] uppercase tracking-wide text-moss">{cat}</p>
            <div className="flex flex-wrap gap-1">
              {list.slice(0, 8).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  title={p.text}
                  onClick={() => onToggle(p.id)}
                  className={`px-2 py-1 font-mono text-[10px] ${
                    selected.has(p.id) ? "bg-forest text-paper" : "bg-mist/50 text-ink/80 hover:bg-mist"
                  }`}
                >
                  {p.id}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <textarea
        value={custom}
        onChange={(e) => onCustom(e.target.value)}
        placeholder="Optional custom payloads (one per line)"
        rows={3}
        className="w-full border border-mist bg-paper/60 px-3 py-2 font-mono text-xs outline-none focus:border-moss"
      />
    </div>
  );
}
