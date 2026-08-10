interface Alert {
  id: string;
  title: string;
  reason: string;
  blockedTo: string;
  subject: string;
  bodyExcerpt: string;
  createdAt: string;
}

interface Props {
  alerts?: Alert[];
}

export default function AlertFeed({ alerts }: Props) {
  return (
    <aside className="border border-alert/30 bg-alert/[0.06] p-4">
      <h3 className="font-display text-sm font-semibold text-alert">Admin alerts</h3>
      {!alerts?.length ? (
        <p className="mt-2 text-sm text-ink/55">No security alerts yet.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {alerts.map((a) => (
            <li key={a.id} className="border-l-2 border-alert pl-3">
              <p className="text-sm font-semibold text-alert">{a.title}</p>
              <p className="mt-1 text-xs text-ink/70">{a.reason}</p>
              {a.blockedTo && (
                <p className="mt-1 font-mono text-[11px]">blocked → {a.blockedTo}</p>
              )}
              <p className="mt-1 font-mono text-[10px] text-ink/45">{a.createdAt}</p>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
