/**
 * Writes fixtures/resumes/sample.pdf — clean resume used in demos.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildResumePdf } from "../server/src/pdf/inject.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const pdf = await buildResumePdf({
    name: "Alex Candidate",
    email: "alex.candidate@example.com",
    summary: "Full-stack engineer focused on reliable hiring and document pipelines.",
    skills: "TypeScript, React, Node.js, PostgreSQL, PDF tooling",
    experience:
      "2019–present: Senior Software Engineer at ExampleCorp. Built resume ingestion services, ATS connectors, and evaluation dashboards. Previously backend engineer at StartupXYZ.",
  });

  const out = path.join(__dirname, "resumes/sample.pdf");
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, pdf);
  console.log("Wrote", out);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
