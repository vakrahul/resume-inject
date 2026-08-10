const COUNTS = [3, 5, 10, 100] as const;

interface Props {
  value: number;
  onChange: (n: number) => void;
}

export default function InjectionCountPicker({ value, onChange }: Props) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-forest/70">Injection count</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {COUNTS.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`min-w-14 px-3 py-2 font-mono text-sm transition ${
              value === n
                ? "bg-signal text-paper"
                : "bg-paper/70 text-ink hover:bg-mist/80"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
