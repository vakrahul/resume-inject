interface Props {
  mail?: unknown[];
  mode: "attack" | "defend";
}

export default function MailStatus({ mail, mode }: Props) {
  if (!mail) return null;
  const items = mail as Array<Record<string, unknown>>;

  return (
    <section>
      <h3 className="font-display text-sm font-semibold">
        Nodemailer — {mode === "attack" ? "Red send path" : "Blue gated path"}
      </h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-ink/60">No mail actions in this run.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {items.map((m, i) => {
            const blocked = Boolean((m as { blocked?: boolean }).blocked);
            const accepted = m.accepted === true;
            return (
              <li
                key={i}
                className={`border px-3 py-2 text-sm ${
                  blocked
                    ? "border-alert/40 bg-alert/10"
                    : accepted
                      ? "border-safe/40 bg-safe/10"
                      : "border-mist bg-paper/40"
                }`}
              >
                <p className="font-mono text-xs">
                  {blocked ? "BLOCKED" : accepted ? (m.dryRun ? "DRY-RUN SENT" : "SENT") : "FAILED"}
                </p>
                <p className="mt-1">
                  to: <span className="font-mono">{String(m.to ?? (m as { blockedTo?: string }).blockedTo ?? "—")}</span>
                </p>
                {m.subject != null && <p className="text-ink/70">subject: {String(m.subject)}</p>}
                {m.messageId != null && (
                  <p className="font-mono text-[10px] text-ink/50">id: {String(m.messageId)}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
