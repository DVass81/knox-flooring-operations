import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, jobPhotosTable, jobsTable, type JobPhotoInsert } from "@workspace/db";
import {
  ListJobPhotosParams,
  ListJobPhotosResponse,
  CreateJobPhotoParams,
  CreateJobPhotoBody,
  DeleteJobPhotoParams,
} from "@workspace/api-zod";
import { ObjectStorageService } from "../lib/objectStorage";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

router.get("/jobs/:id/photos", async (req, res): Promise<void> => {
  const params = ListJobPhotosParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const photos = await db
    .select()
    .from(jobPhotosTable)
    .where(eq(jobPhotosTable.jobId, params.data.id));

  res.json(ListJobPhotosResponse.parse(photos));
});

router.post("/jobs/:id/photos", async (req, res): Promise<void> => {
  const params = CreateJobPhotoParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = CreateJobPhotoBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid job photo body");
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

  const objectPath = objectStorageService.normalizeObjectEntityPath(
    parsed.data.objectPath,
  );

  const values: JobPhotoInsert = {
    id: randomUUID(),
    jobId: params.data.id,
    stage: parsed.data.stage,
    objectPath,
    caption: parsed.data.caption ?? "",
    createdAt: new Date().toISOString(),
  };

  const [photo] = await db.insert(jobPhotosTable).values(values).returning();
  res.status(201).json(photo);
});

router.delete("/jobs/:id/photos/:photoId", async (req, res): Promise<void> => {
  const params = DeleteJobPhotoParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [photo] = await db
    .delete(jobPhotosTable)
    .where(
      and(
        eq(jobPhotosTable.id, params.data.photoId),
        eq(jobPhotosTable.jobId, params.data.id),
      ),
    )
    .returning();

  if (!photo) {
    res.status(404).json({ error: "Photo not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
