import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, settingsTable } from "@workspace/db";
import {
  GetSettingsResponse,
  UpdateSettingsBody,
  UpdateSettingsResponse,
} from "@workspace/api-zod";

const SETTINGS_ID = 1;

const router: IRouter = Router();

router.get("/settings", async (_req, res): Promise<void> => {
  const [settings] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.id, SETTINGS_ID));

  if (!settings) {
    res.status(404).json({ error: "Settings not found" });
    return;
  }

  res.json(GetSettingsResponse.parse(settings));
});

router.patch("/settings", async (req, res): Promise<void> => {
  const parsed = UpdateSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [settings] = await db
    .update(settingsTable)
    .set(parsed.data)
    .where(eq(settingsTable.id, SETTINGS_ID))
    .returning();

  if (!settings) {
    res.status(404).json({ error: "Settings not found" });
    return;
  }

  res.json(UpdateSettingsResponse.parse(settings));
});

export default router;
