import { Router } from "express";
import { getRun } from "../store/runs.js";

export const runsRouter = Router();

runsRouter.get("/:id", async (req, res) => {
  const run = await getRun(req.params.id);
  if (!run) {
    res.status(404).json({ error: "run not found" });
    return;
  }
  res.json(run);
});
