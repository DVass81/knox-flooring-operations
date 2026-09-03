import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  db,
  materialUsageTable,
  jobsTable,
  type MaterialUsageInsert,
} from "@workspace/db";
import {
  ListMaterialUsageParams,
  ListMaterialUsageResponse,
  CreateMaterialUsageParams,
  CreateMaterialUsageBody,
  UpdateMaterialUsageParams,
  UpdateMaterialUsageBody,
  DeleteMaterialUsageParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/jobs/:id/material-usage", async (req, res): Promise<void> => {
  const params = ListMaterialUsageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const rows = await db
    .select()
    .from(materialUsageTable)
    .where(eq(materialUsageTable.jobId, params.data.id));

  res.json(ListMaterialUsageResponse.parse(rows));
});

router.post("/jobs/:id/material-usage", async (req, res): Promise<void> => {
  const params = CreateMaterialUsageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = CreateMaterialUsageBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn(
      { errors: parsed.error.message },
      "Invalid material usage body",
    );
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

  const values: MaterialUsageInsert = {
    id: randomUUID(),
    jobId: params.data.id,
    material: parsed.data.material,
    quantity: parsed.data.quantity,
    cost: parsed.data.cost,
    notes: parsed.data.notes ?? "",
    createdAt: new Date().toISOString(),
  };

  const [row] = await db.insert(materialUsageTable).values(values).returning();
  res.status(201).json(row);
});

router.patch(
  "/jobs/:id/material-usage/:usageId",
  async (req, res): Promise<void> => {
    const params = UpdateMaterialUsageParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const parsed = UpdateMaterialUsageBody.safeParse(req.body);
    if (!parsed.success) {
      req.log.warn(
        { errors: parsed.error.message },
        "Invalid material usage update body",
      );
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [row] = await db
      .update(materialUsageTable)
      .set(parsed.data)
      .where(
        and(
          eq(materialUsageTable.id, params.data.usageId),
          eq(materialUsageTable.jobId, params.data.id),
        ),
      )
      .returning();

    if (!row) {
      res.status(404).json({ error: "Material usage not found" });
      return;
    }

    res.json(row);
  },
);

router.delete(
  "/jobs/:id/material-usage/:usageId",
  async (req, res): Promise<void> => {
    const params = DeleteMaterialUsageParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [row] = await db
      .delete(materialUsageTable)
      .where(
        and(
          eq(materialUsageTable.id, params.data.usageId),
          eq(materialUsageTable.jobId, params.data.id),
        ),
      )
      .returning();

    if (!row) {
      res.status(404).json({ error: "Material usage not found" });
      return;
    }

    res.sendStatus(204);
  },
);

export default router;
