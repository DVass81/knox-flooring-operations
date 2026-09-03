import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  db,
  jobMaterialsTable,
  jobsTable,
  type JobMaterialInsert,
} from "@workspace/db";
import {
  ListJobMaterialsParams,
  ListJobMaterialsResponse,
  CreateJobMaterialParams,
  CreateJobMaterialBody,
  UpdateJobMaterialParams,
  UpdateJobMaterialBody,
  DeleteJobMaterialParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/jobs/:id/materials", async (req, res): Promise<void> => {
  const params = ListJobMaterialsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const rows = await db
    .select()
    .from(jobMaterialsTable)
    .where(eq(jobMaterialsTable.jobId, params.data.id));

  res.json(ListJobMaterialsResponse.parse(rows));
});

router.post("/jobs/:id/materials", async (req, res): Promise<void> => {
  const params = CreateJobMaterialParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = CreateJobMaterialBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid job material body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [job] = await db
    .select({ id: jobsTable.id })
    .from(jobsTable)
    .where(eq(jobsTable.id, params.data.id));

  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const values: JobMaterialInsert = {
    id: randomUUID(),
    jobId: params.data.id,
    name: parsed.data.name,
    quantity: parsed.data.quantity,
    unit: parsed.data.unit,
    createdAt: new Date().toISOString(),
  };

  const [row] = await db.insert(jobMaterialsTable).values(values).returning();
  res.status(201).json(row);
});

router.patch(
  "/jobs/:id/materials/:materialId",
  async (req, res): Promise<void> => {
    const params = UpdateJobMaterialParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const parsed = UpdateJobMaterialBody.safeParse(req.body);
    if (!parsed.success) {
      req.log.warn(
        { errors: parsed.error.message },
        "Invalid job material update body",
      );
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [row] = await db
      .update(jobMaterialsTable)
      .set(parsed.data)
      .where(
        and(
          eq(jobMaterialsTable.id, params.data.materialId),
          eq(jobMaterialsTable.jobId, params.data.id),
        ),
      )
      .returning();

    if (!row) {
      res.status(404).json({ error: "Job material not found" });
      return;
    }

    res.json(row);
  },
);

router.delete(
  "/jobs/:id/materials/:materialId",
  async (req, res): Promise<void> => {
    const params = DeleteJobMaterialParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [row] = await db
      .delete(jobMaterialsTable)
      .where(
        and(
          eq(jobMaterialsTable.id, params.data.materialId),
          eq(jobMaterialsTable.jobId, params.data.id),
        ),
      )
      .returning();

    if (!row) {
      res.status(404).json({ error: "Job material not found" });
      return;
    }

    res.sendStatus(204);
  },
);

export default router;
