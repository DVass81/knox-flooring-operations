import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  db,
  jobMaterialsTable,
  jobsTable,
  productsTable,
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
import { domainRoute } from "../lib/domain-http";
import { DomainError } from "../lib/operations-rules";

const router: IRouter = Router();
async function validateProduct(data: { productId?: string | null; unit?: string; quantity?: number }) {
  if (data.quantity !== undefined && (!Number.isFinite(data.quantity) || data.quantity <= 0)) throw new DomainError(400, "Quantity must be greater than zero.");
  if (!data.productId) return;
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, data.productId));
  if (!product) throw new DomainError(400, "Product not found.");
  if (data.unit !== product.unit) throw new DomainError(400, "Use the catalog product’s unit when recording a linked material.");
}

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

router.post("/jobs/:id/materials", domainRoute(async (req, res) => {
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
    productId: parsed.data.productId,
    quantity: parsed.data.quantity,
    unit: parsed.data.unit,
    createdAt: new Date().toISOString(),
  };
  await validateProduct(values);

  const [row] = await db.insert(jobMaterialsTable).values(values).returning();
  res.status(201).json(row);
}));

router.patch(
  "/jobs/:id/materials/:materialId",
  domainRoute(async (req, res) => {
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

    const [existing] = await db.select().from(jobMaterialsTable).where(and(eq(jobMaterialsTable.id, params.data.materialId), eq(jobMaterialsTable.jobId, params.data.id)));
    if (!existing) { res.status(404).json({ error: "Job material not found" }); return; }
    await validateProduct({ ...existing, ...parsed.data });
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
  }),
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
