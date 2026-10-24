import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { assertMigrationsApplied, pool } from "@workspace/db";

const router: IRouter = Router();

router.get("/healthz", async (_req, res) => {
  try {
    await assertMigrationsApplied(pool);
    res.json(HealthCheckResponse.parse({ status: "ok" }));
  } catch {
    res.status(503).json({ status: "unavailable" });
  }
});

export default router;
