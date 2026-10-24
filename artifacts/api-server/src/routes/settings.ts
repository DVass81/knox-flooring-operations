import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, settingsTable } from "@workspace/db";
import {
  GetSettingsResponse,
  UpdateSettingsBody,
  UpdateSettingsResponse,
} from "@workspace/api-zod";
import { z } from "zod";

const SETTINGS_ID = 1;

const router: IRouter = Router();

router.get("/settings", async (_req, res): Promise<void> => {
  if (process.env.READ_ONLY_RECOVERY !== "true") await db.insert(settingsTable).values({ id: SETTINGS_ID }).onConflictDoNothing();
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
  if (["estimatePolicy", "transitionPolicy", "companyLogoUrl", "customerAccentColor"].some(key => key in parsed.data) && (req.auth?.actualRole !== "owner" || req.auth.previewRole)) {
    res.status(403).json({ error: "Only the owner outside role preview can change company branding and operating policies." }); return;
  }
  if (parsed.data.estimatePolicy) {
    const policy = z.object({ version: z.number().int().positive(), targetMarginPercent: z.number().finite().min(0).lt(100), reviewed: z.boolean().optional(), laborRates: z.record(z.string(), z.number().finite().nonnegative().nullable()), productivitySqFtPerHour: z.record(z.string(), z.number().finite().positive().nullable()).optional() }).safeParse(parsed.data.estimatePolicy);
    if (!policy.success) { res.status(400).json({ error: "Enter a valid estimate policy with finite rates and a margin below 100%." }); return; }
    parsed.data.estimatePolicy = policy.data;
  }
  if (parsed.data.transitionPolicy) {
    const policy = z.object({ requireReceivedMaterials: z.boolean().optional(), requiredCompletionChecks: z.array(z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,80}$/)).max(30).optional() }).safeParse(parsed.data.transitionPolicy);
    if (!policy.success) { res.status(400).json({ error: "Enter valid completion checklist keys." }); return; }
    parsed.data.transitionPolicy = policy.data;
  }
  await db.insert(settingsTable).values({ id: SETTINGS_ID }).onConflictDoNothing();

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
