/**
 * Run red then blue harnesses sequentially.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const count = process.argv[2] || "5";

function run(script: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--import", "tsx", path.join(__dirname, script), count],
      {
        stdio: "inherit",
        env: process.env,
        cwd: path.join(__dirname, ".."),
      },
    );
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });
}

async function main() {
  const red = await run("red-attack.ts");
  const blue = await run("blue-defend.ts");
  process.exit(red === 0 && blue === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
