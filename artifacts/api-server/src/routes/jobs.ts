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
import { queueQuickBooksReview } from "../lib/quickbooks-queue";
import { jobReadiness, updateJobWithReadiness } from "../lib/job-readiness";
import { domainRoute } from "../lib/domain-http";
import { DomainError } from "../lib/operations-rules";
import { nextDocumentNumber } from "../lib/conversions";
import { ensureCustomer, validateCustomerLinks } from "../lib/estimate-service";
import { deleteUnreferencedJob } from "../lib/job-deletion";

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

router.post(
  "/jobs",
  domainRoute(async (req, res) => {
    const parsed = CreateJobBody.safeParse(req.body);
    if (!parsed.success) {
      req.log.warn({ errors: parsed.error.message }, "Invalid job body");
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const now = new Date().toISOString();
    const job = await db.transaction(async (tx) => {
      const customerId = await ensureCustomer(tx, parsed.data);
      const [created] = await tx
        .insert(jobsTable)
        .values({
          ...parsed.data,
          customerId,
          id: randomUUID(),
          jobNumber: await nextDocumentNumber(tx, "job"),
          shareToken: generateShareToken(),
          stageHistory: [{ stage: parsed.data.status, at: now }],
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      if (
        ["Scheduled", "In Progress", "Completed", "Invoiced"].includes(
          created.status,
        )
      ) {
        // Creation cannot bypass the same readiness rules used for later transitions.
        const readiness = await jobReadiness(tx, created.id, created.status);
        if (readiness.blockers.length)
          throw new DomainError(
            409,
            "Complete readiness checks before creating a job at this stage.",
            readiness,
          );
      }
      return created;
    });
    await queueQuickBooksReview("customer", job.id, "create", stripNulls(job));
    await queueQuickBooksReview("project", job.id, "create", stripNulls(job), [
      "Customer must be linked before this project is approved",
    ]);
    res.status(201).json(GetJobResponse.parse(stripNulls(job)));
  }),
);

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

router.patch(
  "/jobs/:id",
  domainRoute(async (req, res) => {
    const params = UpdateJobParams.parse(req.params);
    const parsed = UpdateJobBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { revision, ...updates } = parsed.data;
    if (
      req.auth!.role === "installer" &&
      [
        "laborEstimate",
        "materialEstimate",
        "estLaborHours",
        "estRevenue",
        "estGrossProfit",
        "grossMarginPct",
        "actualRevenue",
        "actualLaborCost",
        "actualMaterialCost",
        "actualAddOnCost",
        "estimateSnapshot",
        "customerId",
        "siteId",
      ].some((key) => key in req.body)
    )
      throw new DomainError(
        403,
        "Financial and customer records require an office role.",
      );
    const job = await db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(jobsTable)
        .where(eq(jobsTable.id, params.id))
        .for("update");
      await validateCustomerLinks(
        tx,
        updates.customerId === undefined
          ? current?.customerId
          : updates.customerId,
        updates.siteId === undefined ? current?.siteId : updates.siteId,
      );
      return updateJobWithReadiness(
        tx,
        params.id,
        updates,
        req.auth!,
        revision,
      );
    });
    await queueQuickBooksReview("project", job.id, "update", stripNulls(job));
    res.json(UpdateJobResponse.parse(stripNulls(job)));
  }),
);

router.delete(
  "/jobs/:id",
  domainRoute(async (req, res) => {
    const params = DeleteJobParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    await db.transaction((tx) => deleteUnreferencedJob(tx, params.data.id));
    res.sendStatus(204);
  }),
);

export default router;
