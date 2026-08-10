import { Router } from "express";
import { getPatterns, ATTACK_PATTERNS } from "../catalog/index.js";

export const catalogRouter = Router();

catalogRouter.get("/patterns", (req, res) => {
  const limit = req.query.limit ? Number(req.query.limit) : undefined;
  const category = req.query.category as string | undefined;
  let patterns = getPatterns(limit);
  if (category) {
    patterns = patterns.filter((p) => p.category === category);
  }
  res.json({
    total: ATTACK_PATTERNS.length,
    count: patterns.length,
    patterns,
  });
});
