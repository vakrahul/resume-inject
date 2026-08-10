import { useEffect, useState } from "react";
import {
  fetchPatterns,
  injectResume,
  runAttack,
  runDefend,
  type AttackResult,
  type DefendResult,
  type InjectResult,
  type Mode,
  type Pattern,
} from "../api";
import ResumeUpload from "../components/ResumeUpload";
import InjectionCountPicker from "../components/InjectionCountPicker";
import PayloadLibrary from "../components/PayloadLibrary";
import AgentTrace from "../components/AgentTrace";
import MailStatus from "../components/MailStatus";
import AlertFeed from "../components/AlertFeed";

export default function Sandbox() {
  const [mode, setMode] = useState<Mode>("attack");
  const [count, setCount] = useState(5);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [custom, setCustom] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("Alex Candidate");
  const [skills, setSkills] = useState("Python, React, security testing");
  const [experience, setExperience] = useState(
    "Built hiring automation demos and studied LLM prompt-injection defenses.",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [injectResult, setInjectResult] = useState<InjectResult | null>(null);
  const [attack, setAttack] = useState<AttackResult | null>(null);
  const [defend, setDefend] = useState<DefendResult | null>(null);

  useEffect(() => {
    fetchPatterns(100)
      .then((r) => setPatterns(r.patterns))
      .catch((e) => setError(String(e.message || e)));
  }, []);

  function toggleId(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function buildInjectForm(): Promise<FormData> {
    const form = new FormData();
    form.append("count", String(count));
    if (file) form.append("resume", file);
    else {
      form.append("name", name);
      form.append("skills", skills);
      form.append("experience", experience);
    }
    if (selected.size) form.append("payloadIds", JSON.stringify([...selected]));
    const customs = custom
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (customs.length) form.append("customPayloads", JSON.stringify(customs));
    return form;
  }

  async function onInjectOnly() {
    setBusy(true);
    setError(null);
    setAttack(null);
    setDefend(null);
    try {
      const result = await injectResume(await buildInjectForm());
      setInjectResult(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onGenerate() {
    setBusy(true);
    setError(null);
    setAttack(null);
    setDefend(null);
    try {
      const result = await injectResume(await buildInjectForm());
      setInjectResult(result);

      if (mode === "attack") {
        const red = await runAttack(result.run_id);
        setAttack(red);
      } else {
        const blue = await runDefend(result.run_id);
        setDefend(blue);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const trace = mode === "attack" ? attack : defend;

  return (
    <div className="mx-auto min-h-screen max-w-7xl px-4 py-8 md:px-8">
      <header className="animate-fade-up mb-10">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-moss">Educational lab</p>
        <h1 className="font-display mt-2 text-4xl font-extrabold tracking-tight text-forest md:text-5xl">
          ResumeGuard AI
        </h1>
        <p className="mt-3 max-w-2xl text-base text-ink/70">
          Poison a resume with invisible prompt injections, watch a naive Gemini screener call{" "}
          <span className="font-mono text-sm">Nodemailer</span>, then defend with sanitize + policy
          gates that block unauthorized mail before SMTP runs.
        </p>
        <p className="mt-2 text-xs text-ink/45">
          Demo only — supply your own Gemini key and SMTP credentials. Do not use real candidate data.
        </p>
      </header>

      <div className="animate-fade-up-delay mb-6 flex gap-2">
        {(["attack", "defend"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`px-5 py-2.5 font-display text-sm font-semibold uppercase tracking-wide transition ${
              mode === m
                ? m === "attack"
                  ? "bg-signal text-paper"
                  : "bg-safe text-paper"
                : "bg-paper/70 text-ink/70 hover:bg-mist/70"
            }`}
          >
            {m === "attack" ? "Attack (Red)" : "Defend (Blue)"}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <section className="space-y-5 border border-mist/90 bg-paper/50 p-5 backdrop-blur-sm">
          <h2 className="font-display text-lg font-bold text-forest">Resume + injections</h2>
          <ResumeUpload
            file={file}
            onFile={setFile}
            name={name}
            skills={skills}
            experience={experience}
            onName={setName}
            onSkills={setSkills}
            onExperience={setExperience}
          />
          <InjectionCountPicker value={count} onChange={setCount} />
          <PayloadLibrary
            patterns={patterns}
            selected={selected}
            onToggle={toggleId}
            custom={custom}
            onCustom={setCustom}
          />
          <div className="flex flex-col gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={onInjectOnly}
              className={`w-full py-3 font-display text-sm font-bold uppercase tracking-wider transition ${
                busy
                  ? "animate-pulse-soft bg-mist text-ink/50"
                  : "border border-forest bg-paper text-forest hover:bg-mist/60"
              }`}
            >
              {busy ? "Working…" : "Inject only (then download)"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onGenerate}
              className={`w-full py-3 font-display text-sm font-bold uppercase tracking-wider text-paper transition ${
                busy ? "animate-pulse-soft bg-forest/60" : "bg-forest hover:bg-moss"
              }`}
            >
              {busy
                ? "Running…"
                : mode === "attack"
                  ? "Inject & Red attack"
                  : "Inject & Blue defend"}
            </button>
          </div>
          {error && <p className="text-sm text-alert">{error}</p>}
          {injectResult && (
            <div className="space-y-2 border border-moss/30 bg-moss/5 p-3">
              <p className="font-mono text-xs text-moss">
                run {injectResult.run_id.slice(0, 8)}… · {injectResult.injectionCount} payloads
                embedded
              </p>
              {injectResult.visualNote && (
                <p className="text-xs text-ink/60">{injectResult.visualNote}</p>
              )}
              <div className="flex flex-wrap gap-2">
                <a
                  href={injectResult.poisonedPdfUrl}
                  download={`resumeguard-poisoned-${injectResult.run_id.slice(0, 8)}.pdf`}
                  className="bg-signal px-3 py-2 font-display text-xs font-bold uppercase tracking-wide text-paper hover:opacity-90"
                >
                  Download poisoned PDF
                </a>
                {injectResult.latexUrl && (
                  <a
                    href={injectResult.latexUrl}
                    download={`resumeguard-poisoned-${injectResult.run_id.slice(0, 8)}.tex`}
                    className="border border-forest px-3 py-2 font-display text-xs font-bold uppercase tracking-wide text-forest hover:bg-mist/50"
                  >
                    Download LaTeX (.tex)
                  </a>
                )}
              </div>
              <p className="text-[11px] text-ink/45">
                PDF looks like the original resume; injections are white/tiny/off-page text that
                extractors and LLMs still read. LaTeX uses the same idea with white/tiny color
                payloads so the compiled page keeps the same visual texture.
              </p>
            </div>
          )}
        </section>

        <section className="space-y-5 border border-mist/90 bg-paper/55 p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-bold text-forest">HR automation view</h2>
            <span
              className={`font-mono text-[10px] uppercase tracking-wider ${
                mode === "attack" ? "text-signal" : "text-safe"
              }`}
            >
              {mode === "attack" ? "naive gemini → nodemailer" : "sanitize → gate → alert"}
            </span>
          </div>

          <AgentTrace
            extractedText={trace?.extractedText ?? injectResult?.extractedText}
            highlights={trace?.highlights ?? injectResult?.highlights}
            thoughts={trace?.thoughts}
            modelText={trace?.modelText}
            toolCalls={trace?.toolCalls as AttackResult["toolCalls"]}
          />

          <MailStatus mail={trace?.mail} mode={mode} />

          {mode === "defend" && defend && (
            <>
              {defend.sanitize && (
                <section>
                  <h3 className="font-display text-sm font-semibold">Sanitization</h3>
                  <p className="mt-1 text-sm text-ink/70">
                    {defend.sanitize.suspectedInjectionCount} findings · cleaned text fed to Gemini
                    inside untrusted delimiters
                  </p>
                  <ul className="mt-2 max-h-28 space-y-1 overflow-auto font-mono text-[11px]">
                    {defend.sanitize.findings.slice(0, 12).map((f, i) => (
                      <li key={i}>
                        [{f.severity}] {f.type}: {f.excerpt}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {defend.cleanPdfUrl && (
                      <a
                        href={defend.cleanPdfUrl}
                        download={`resumeguard-clean-${defend.run_id.slice(0, 8)}.pdf`}
                        className="bg-safe px-3 py-2 font-display text-xs font-bold uppercase tracking-wide text-paper hover:opacity-90"
                      >
                        Download clean PDF
                      </a>
                    )}
                    {defend.originalPdfUrl && (
                      <a
                        href={defend.originalPdfUrl}
                        download={`resumeguard-original-${defend.run_id.slice(0, 8)}.pdf`}
                        className="border border-safe px-3 py-2 font-display text-xs font-bold uppercase tracking-wide text-safe hover:bg-safe/10"
                      >
                        Download original (pre-inject)
                      </a>
                    )}
                  </div>
                  <p className="mt-2 text-[11px] text-ink/45">
                    Red download = poisoned PDF with hidden prompts. Blue download = cleaned PDF with
                    those injections stripped.
                  </p>
                </section>
              )}
              <AlertFeed alerts={defend.alerts} />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
