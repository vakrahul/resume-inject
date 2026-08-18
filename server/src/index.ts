import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { redRouter } from "./routes/red.js";
import { blueRouter } from "./routes/blue.js";
import { catalogRouter } from "./routes/catalog.js";
import { runsRouter } from "./routes/runs.js";
import { loadPdf } from "./store/runs.js";

dotenv.config();

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "*";

// Build the Express app synchronously — no top-level await
// (ensureDataDirs is a no-op in the in-memory store)
export const app = express();

// Basic rate limiter middleware to prevent abuse
const requestCounts = new Map<string, { count: number, resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60000;
const MAX_REQUESTS_PER_WINDOW = 100;

app.use((req, res, next) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  
  if (!requestCounts.has(ip)) {
    requestCounts.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
  } else {
    const data = requestCounts.get(ip)!;
    if (now > data.resetTime) {
      data.count = 1;
      data.resetTime = now + RATE_LIMIT_WINDOW_MS;
    } else {
      data.count++;
      if (data.count > MAX_REQUESTS_PER_WINDOW) {
        res.status(429).json({ error: "Too many requests, please try again later." });
        return;
      }
    }
  }
  next();
});

// Logging middleware to track API usage and performance
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[API] ${req.method} ${req.originalUrl} - ${res.statusCode} [${duration}ms]`);
  });
  next();
});

app.use(
  cors({
    origin: CLIENT_ORIGIN === "*" ? true : CLIENT_ORIGIN,
  }),
);
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    product: "ResumeGuard AI",
    runtime: "node-express",
    mail: process.env.MAIL_DRY_RUN === "true" ? "dry-run" : "live-nodemailer",
    llm: process.env.GEMINI_API_KEY ? "gemini" : "fallback-simulator",
  });
});

app.use("/api/red", redRouter);
app.use("/api/blue", blueRouter);
app.use("/api/catalog", catalogRouter);
app.use("/api/runs", runsRouter);

// Serve PDFs from in-memory store (replaces static file server on disk)
app.get("/api/files/:filename", (req, res) => {
  const filename = req.params.filename;
  const key = filename.replace(/\.pdf$/, "");
  const buf = loadPdf(key);
  if (!buf) {
    res.status(404).json({ error: "File not found or expired" });
    return;
  }
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(buf);
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  const message = err instanceof Error ? err.message : "Internal error";
  res.status(500).json({ error: message });
});

// Only start the HTTP server when running locally (not on Vercel)
if (!process.env.VERCEL) {
  const PORT = Number(process.env.PORT || 3010);
  app.listen(PORT, () => {
    console.log(`ResumeGuard AI (Node + Nodemailer) on http://localhost:${PORT}`);
  });
}
