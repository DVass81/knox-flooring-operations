import { Router, type IRouter } from "express";
import { randomBytes, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, jobsTable, type JobInsert, type StageEvent } from "@workspace/db";
import {
  ListJobsResponse,
  CreateJobBody,
  GetJobParams,
  GetJobResponse,
  UpdateJobParams,
  UpdateJobBody,
  UpdateJobResponse,
  DeleteJobParams,
} from "@workspace/api-zod";
import { stripNulls } from "../lib/strip-nulls";

const router: IRouter = Router();

function nextJobNumber(existing: string[]): string {
  const nums = existing
    .map((n) => parseInt(n.replace(/\D/g, ""), 10))
    .filter((n) => !Number.isNaN(n));
  const max = nums.length ? Math.max(...nums) : 1000;
  return `J-${max + 1}`;
}

function generateShareToken(): string {
  return randomBytes(12).toString("hex");
}

router.get("/jobs", async (_req, res): Promise<void> => {
  const jobs = await db.select().from(jobsTable);
  res.json(ListJobsResponse.parse(jobs.map(stripNulls)));
});

router.post("/jobs", async (req, res): Promise<void> => {
  const parsed = CreateJobBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid job body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const existing = await db
    .select({ jobNumber: jobsTable.jobNumber })
    .from(jobsTable);
  const now = new Date().toISOString();

  const values: JobInsert = {
    ...parsed.data,
    id: randomUUID(),
    jobNumber: nextJobNumber(existing.map((j) => j.jobNumber)),
    shareToken: generateShareToken(),
    stageHistory: [{ stage: parsed.data.status, at: now }],
    createdAt: now,
    updatedAt: now,
  };

  const [job] = await db.insert(jobsTable).values(values).returning();
  res.status(201).json(GetJobResponse.parse(stripNulls(job)));
});

router.get("/jobs/:id", async (req, res): Promise<void> => {
  const params = GetJobParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [job] = await db
    .select()
    .from(jobsTable)
    .where(eq(jobsTable.id, params.data.id));

  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  res.json(GetJobResponse.parse(stripNulls(job)));
});

router.patch("/jobs/:id", async (req, res): Promise<void> => {
  const params = UpdateJobParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateJobBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid job update body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [current] = await db
    .select()
    .from(jobsTable)
    .where(eq(jobsTable.id, params.data.id));

  if (!current) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const now = new Date().toISOString();
  const statusChanged =
    parsed.data.status !== undefined && parsed.data.status !== current.status;
  const nextStageHistory: StageEvent[] = statusChanged
    ? [...current.stageHistory, { stage: parsed.data.status as string, at: now }]
    : current.stageHistory;

  const [job] = await db
    .update(jobsTable)
    .set({ ...parsed.data, stageHistory: nextStageHistory, updatedAt: now })
    .where(eq(jobsTable.id, params.data.id))
    .returning();

  res.json(UpdateJobResponse.parse(stripNulls(job)));
});

router.delete("/jobs/:id", async (req, res): Promise<void> => {
  const params = DeleteJobParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [job] = await db
    .delete(jobsTable)
    .where(eq(jobsTable.id, params.data.id))
    .returning();

  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
