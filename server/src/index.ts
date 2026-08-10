import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { redRouter } from "./routes/red.js";
import { blueRouter } from "./routes/blue.js";
import { catalogRouter } from "./routes/catalog.js";
import { runsRouter } from "./routes/runs.js";
import { ensureDataDirs } from "./store/runs.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../../.env") });
dotenv.config();

const PORT = Number(process.env.PORT || 3010);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5174";

await ensureDataDirs();

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    product: "ResumeGuard AI",
    runtime: "node-express",
    mail: process.env.MAIL_DRY_RUN === "true" ? "dry-run" : "live-nodemailer",
  });
});

app.use("/api/red", redRouter);
app.use("/api/blue", blueRouter);
app.use("/api/catalog", catalogRouter);
app.use("/api/runs", runsRouter);

app.use("/files", express.static(path.join(__dirname, "../data/uploads")));

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  const message = err instanceof Error ? err.message : "Internal error";
  res.status(500).json({ error: message });
});

app.listen(PORT, () => {
  console.log(`ResumeGuard AI (Node + Nodemailer) on http://localhost:${PORT}`);
});
