interface Props {
  file: File | null;
  onFile: (f: File | null) => void;
  name: string;
  skills: string;
  experience: string;
  onName: (v: string) => void;
  onSkills: (v: string) => void;
  onExperience: (v: string) => void;
}

export default function ResumeUpload({
  file,
  onFile,
  name,
  skills,
  experience,
  onName,
  onSkills,
  onExperience,
}: Props) {
  return (
    <div className="space-y-4">
      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wider text-forest/70">Resume PDF</span>
        <input
          type="file"
          accept="application/pdf,.pdf"
          className="mt-2 block w-full text-sm file:mr-3 file:border-0 file:bg-forest file:px-3 file:py-2 file:font-medium file:text-paper"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
        {file && <p className="mt-1 font-mono text-xs text-moss">{file.name}</p>}
      </label>

      <p className="text-xs text-ink/55">Or paste a simple resume (used if no PDF uploaded):</p>
      <input
        value={name}
        onChange={(e) => onName(e.target.value)}
        placeholder="Full name"
        className="w-full border border-mist bg-paper/60 px-3 py-2 text-sm outline-none focus:border-moss"
      />
      <input
        value={skills}
        onChange={(e) => onSkills(e.target.value)}
        placeholder="Skills"
        className="w-full border border-mist bg-paper/60 px-3 py-2 text-sm outline-none focus:border-moss"
      />
      <textarea
        value={experience}
        onChange={(e) => onExperience(e.target.value)}
        placeholder="Experience / summary"
        rows={4}
        className="w-full resize-y border border-mist bg-paper/60 px-3 py-2 text-sm outline-none focus:border-moss"
      />
    </div>
  );
}
