import { Router, type IRouter } from "express";
import { db, materialsTable } from "@workspace/db";
import { ListMaterialsResponse } from "@workspace/api-zod";
import { stripNulls } from "../lib/strip-nulls";

const router: IRouter = Router();

router.get("/materials", async (_req, res): Promise<void> => {
  const materials = await db.select().from(materialsTable);
  res.json(ListMaterialsResponse.parse(materials.map(stripNulls)));
});

export default router;
