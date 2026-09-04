import { Router, type IRouter } from "express";
import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  auditEventsTable,
  db,
  demoBaselinesTable,
  demoOutboxTable,
  demoRecordOriginsTable,
  invoicesTable,
  jobsTable,
  leadsTable,
  productsTable,
  proposalsTable,
  tourProgressTable,
  trainingAudioCacheTable,
  trainingPreferencesTable,
  trainingRunsTable,
} from "@workspace/db";
import { audit } from "../lib/auth";
import { PAGE_GUIDES, TRAINING_MANIFEST_VERSION, TRAINING_MISSIONS, canCompleteTrainingStep, findTrainingStep } from "../lib/training";
import { requireOwner } from "../middlewares/auth";
import { SEED_INVOICES, SEED_JOBS, SEED_LEADS, SEED_PRODUCTS, SEED_PROPOSALS } from "../lib/seed-data";

const router: IRouter = Router();
const runStatuses = new Set(["active", "paused", "completed", "dismissed"]);

function canUseMission(req: Express.Request, role: string) {
  return req.auth?.role === role;
}

async function saveLegacyProgress(userId: string, missionKey: string, currentStep: number, status: string, checkpoints: string[], startedAt: string, completedAt: string | null) {
  const now = new Date().toISOString();
  const [existing] = await db.select().from(tourProgressTable)
    .where(and(eq(tourProgressTable.userId, userId), eq(tourProgressTable.missionKey, missionKey))).limit(1);
  const values = { currentStep, status, checkpoints, startedAt, completedAt, updatedAt: now };
  if (existing) await db.update(tourProgressTable).set(values).where(eq(tourProgressTable.id, existing.id));
  else await db.insert(tourProgressTable).values({ id: randomUUID(), userId, missionKey, ...values });
}

router.get("/demo/status", async (req, res) => {
  const [[baseline], progress, runs, [savedPreferences]] = await Promise.all([
    db.select().from(demoBaselinesTable).where(eq(demoBaselinesTable.active, true)).limit(1),
    db.select().from(tourProgressTable).where(eq(tourProgressTable.userId, req.auth!.userId)),
    db.select().from(trainingRunsTable).where(eq(trainingRunsTable.userId, req.auth!.userId)).orderBy(desc(trainingRunsTable.updatedAt)),
    db.select().from(trainingPreferencesTable).where(eq(trainingPreferencesTable.userId, req.auth!.userId)).limit(1),
  ]);
  const role = req.auth!.role;
  const missions = TRAINING_MISSIONS.filter((mission) => req.auth!.actualRole === "owner" || mission.role === role);
  const pageGuides = PAGE_GUIDES.filter((guide) => guide.role.includes(role));
  res.json({
    enabled: true,
    manifestVersion: TRAINING_MANIFEST_VERSION,
    baseline: baseline ?? { version: "2026.1", label: "Executive demo", recordCounts: {} },
    missions,
    pageGuides,
    progress,
    runs,
    preferences: savedPreferences ?? { userId: req.auth!.userId, voiceEnabled: false, captionsEnabled: true, welcomeDismissed: false },
  });
});

router.get("/demo/outbox", async (_req, res) => {
  res.json(await db.select().from(demoOutboxTable).orderBy(desc(demoOutboxTable.createdAt)).limit(100));
});

router.post("/demo/training/reset", requireOwner, async (req, res) => {
  await db.transaction(async (tx) => {
    await tx.delete(trainingRunsTable).where(eq(trainingRunsTable.userId, req.auth!.userId));
    await tx.delete(tourProgressTable).where(eq(tourProgressTable.userId, req.auth!.userId));
    await tx.delete(trainingPreferencesTable).where(eq(trainingPreferencesTable.userId, req.auth!.userId));
  });
  await audit("training.reset", { userId: req.auth!.userId, entityType: "training", entityId: req.auth!.userId, ip: req.ip, details: { invitationRestored: true } });
  res.json({ ok: true, invitationRestored: true });
});

router.put("/demo/preferences", async (req, res) => {
  const now = new Date().toISOString();
  const [existing] = await db.select().from(trainingPreferencesTable)
    .where(eq(trainingPreferencesTable.userId, req.auth!.userId)).limit(1);
  const values = {
    voiceEnabled: typeof req.body?.voiceEnabled === "boolean" ? req.body.voiceEnabled : existing?.voiceEnabled ?? false,
    captionsEnabled: true,
    welcomeDismissed: typeof req.body?.welcomeDismissed === "boolean" ? req.body.welcomeDismissed : existing?.welcomeDismissed ?? false,
    updatedAt: now,
  };
  if (existing) await db.update(trainingPreferencesTable).set(values).where(eq(trainingPreferencesTable.userId, req.auth!.userId));
  else await db.insert(trainingPreferencesTable).values({ userId: req.auth!.userId, ...values });
  await audit("training.preferences.updated", { userId: req.auth!.userId, entityType: "training_preferences", entityId: req.auth!.userId, ip: req.ip, details: values });
  res.json({ userId: req.auth!.userId, ...values });
});

router.post("/demo/missions/:key/start", async (req, res) => {
  const mission = TRAINING_MISSIONS.find((item) => item.key === req.params.key);
  if (!mission) { res.status(404).json({ error: "Mission not found" }); return; }
  if (!canUseMission(req, mission.role)) { res.status(403).json({ error: `Switch to the ${mission.role} perspective to start this mission` }); return; }
  const now = new Date().toISOString();
  const id = randomUUID();
  const voiceEnabled = req.body?.voiceEnabled === true;
  await db.transaction(async (tx) => {
    await tx.update(trainingRunsTable).set({ status: "dismissed", updatedAt: now })
      .where(and(eq(trainingRunsTable.userId, req.auth!.userId), eq(trainingRunsTable.missionKey, mission.key), eq(trainingRunsTable.status, "active")));
    await tx.insert(trainingRunsTable).values({
      id,
      userId: req.auth!.userId,
      missionKey: mission.key,
      manifestVersion: TRAINING_MANIFEST_VERSION,
      status: "active",
      currentStep: 0,
      voiceEnabled,
      checkpoints: [],
      practiceData: { namespace: `training:${id}`, isolated: true, externalSync: false, externalCommunication: false },
      startedAt: now,
      updatedAt: now,
    });
    const [preferences] = await tx.select().from(trainingPreferencesTable).where(eq(trainingPreferencesTable.userId, req.auth!.userId)).limit(1);
    const nextPreferences = { voiceEnabled, captionsEnabled: true, welcomeDismissed: true, updatedAt: now };
    if (preferences) await tx.update(trainingPreferencesTable).set(nextPreferences).where(eq(trainingPreferencesTable.userId, req.auth!.userId));
    else await tx.insert(trainingPreferencesTable).values({ userId: req.auth!.userId, ...nextPreferences });
  });
  await saveLegacyProgress(req.auth!.userId, mission.key, 0, "active", [], now, null);
  await audit("training.mission.started", { userId: req.auth!.userId, entityType: "training_run", entityId: id, ip: req.ip, details: { missionKey: mission.key, voiceEnabled, manifestVersion: TRAINING_MANIFEST_VERSION } });
  res.status(201).json({ id, userId: req.auth!.userId, missionKey: mission.key, manifestVersion: TRAINING_MANIFEST_VERSION, status: "active", currentStep: 0, voiceEnabled, checkpoints: [], startedAt: now, updatedAt: now });
});

router.put("/demo/missions/:key", async (req, res) => {
  const mission = TRAINING_MISSIONS.find((item) => item.key === req.params.key);
  if (!mission) { res.status(404).json({ error: "Mission not found" }); return; }
  const runId = String(req.body?.runId ?? "");
  const [run] = await db.select().from(trainingRunsTable)
    .where(and(eq(trainingRunsTable.id, runId), eq(trainingRunsTable.userId, req.auth!.userId), eq(trainingRunsTable.missionKey, mission.key))).limit(1);
  if (!run) { res.status(404).json({ error: "Training run not found" }); return; }
  const status = runStatuses.has(req.body?.status) ? String(req.body.status) : run.status;
  const currentStep = Math.max(0, Math.min(Number(req.body?.currentStep ?? run.currentStep), mission.steps.length - 1));
  const now = new Date().toISOString();
  const completedAt = status === "completed" ? now : run.completedAt;
  const values = { status, currentStep, completedAt, updatedAt: now };
  await db.update(trainingRunsTable).set(values).where(eq(trainingRunsTable.id, run.id));
  await saveLegacyProgress(run.userId, run.missionKey, currentStep, status, run.checkpoints, run.startedAt, completedAt);
  res.json({ ...run, ...values });
});

router.post("/demo/missions/:key/verify", async (req, res) => {
  const mission = TRAINING_MISSIONS.find((item) => item.key === req.params.key);
  if (!mission) { res.status(404).json({ error: "Mission not found" }); return; }
  const runId = String(req.body?.runId ?? "");
  const [run] = await db.select().from(trainingRunsTable)
    .where(and(eq(trainingRunsTable.id, runId), eq(trainingRunsTable.userId, req.auth!.userId), eq(trainingRunsTable.missionKey, mission.key))).limit(1);
  if (!run) { res.status(404).json({ error: "Training run not found" }); return; }
  if (run.manifestVersion !== TRAINING_MANIFEST_VERSION) { res.status(409).json({ error: "Training content changed. Restart this mission to continue." }); return; }
  const step = mission.steps[run.currentStep];
  if (!step || step.id !== req.body?.stepId) { res.status(409).json({ error: "This is not the active training step" }); return; }
  const skipped = req.body?.skipped === true;
  if (!canCompleteTrainingStep(step, req.body?.targetInteracted === true, skipped)) {
    await audit("training.step.validation_failed", { userId: req.auth!.userId, entityType: "training_run", entityId: run.id, ip: req.ip, details: { missionKey: mission.key, stepId: step.id, reason: "target_not_interacted" } });
    res.status(422).json({ error: "Use the highlighted control before checking this step" });
    return;
  }
  const checkpoint = skipped ? `${step.id}:skipped` : step.id;
  const checkpoints = Array.from(new Set([...run.checkpoints, checkpoint]));
  const lastStep = run.currentStep >= mission.steps.length - 1;
  const now = new Date().toISOString();
  const values = { checkpoints, currentStep: lastStep ? run.currentStep : run.currentStep + 1, status: lastStep ? "completed" : "active", completedAt: lastStep ? now : null, updatedAt: now };
  await db.update(trainingRunsTable).set(values).where(eq(trainingRunsTable.id, run.id));
  await saveLegacyProgress(run.userId, run.missionKey, values.currentStep, values.status, checkpoints, run.startedAt, values.completedAt);
  await audit(lastStep ? "training.mission.completed" : "training.step.verified", { userId: req.auth!.userId, entityType: "training_run", entityId: run.id, ip: req.ip, details: { missionKey: mission.key, stepId: step.id, skipped } });
  res.json({ ...run, ...values, verifiedStepId: step.id, complete: lastStep });
});

router.post("/demo/missions/:key/exit", async (req, res) => {
  const runId = String(req.body?.runId ?? "");
  const [run] = await db.select().from(trainingRunsTable)
    .where(and(eq(trainingRunsTable.id, runId), eq(trainingRunsTable.userId, req.auth!.userId), eq(trainingRunsTable.missionKey, req.params.key))).limit(1);
  if (!run) { res.status(404).json({ error: "Training run not found" }); return; }
  const status = req.body?.discard === true ? "dismissed" : "paused";
  const now = new Date().toISOString();
  await db.update(trainingRunsTable).set({ status, updatedAt: now }).where(eq(trainingRunsTable.id, run.id));
  await saveLegacyProgress(run.userId, run.missionKey, run.currentStep, status, run.checkpoints, run.startedAt, run.completedAt);
  await audit(status === "paused" ? "training.mission.paused" : "training.mission.exited", { userId: req.auth!.userId, entityType: "training_run", entityId: run.id, ip: req.ip, details: { missionKey: run.missionKey } });
  res.json({ ...run, status, updatedAt: now });
});

router.post("/demo/missions/:key/restart", async (req, res) => {
  const runId = String(req.body?.runId ?? "");
  const [run] = await db.select().from(trainingRunsTable)
    .where(and(eq(trainingRunsTable.id, runId), eq(trainingRunsTable.userId, req.auth!.userId), eq(trainingRunsTable.missionKey, req.params.key))).limit(1);
  if (!run) { res.status(404).json({ error: "Training run not found" }); return; }
  const now = new Date().toISOString();
  const values = { manifestVersion: TRAINING_MANIFEST_VERSION, status: "active", currentStep: 0, checkpoints: [] as string[], practiceData: { namespace: `training:${run.id}`, isolated: true, externalSync: false, externalCommunication: false }, startedAt: now, completedAt: null, updatedAt: now };
  await db.update(trainingRunsTable).set(values).where(eq(trainingRunsTable.id, run.id));
  await saveLegacyProgress(run.userId, run.missionKey, 0, "active", [], now, null);
  await audit("training.mission.restarted", { userId: req.auth!.userId, entityType: "training_run", entityId: run.id, ip: req.ip, details: { missionKey: run.missionKey } });
  res.json({ ...run, ...values });
});

router.get("/demo/audio/:stepId", async (req, res) => {
  const found = findTrainingStep(req.params.stepId);
  if (!found) { res.status(404).json({ error: "Narration script not found" }); return; }
  const model = process.env.OPENAI_TTS_MODEL?.trim() || "gpt-4o-mini-tts";
  const voice = process.env.OPENAI_TTS_VOICE?.trim() || "marin";
  const scriptHash = createHash("sha256").update(`${TRAINING_MANIFEST_VERSION}\n${model}\n${voice}\n${found.step.narration}`).digest("hex");
  const [cached] = await db.select().from(trainingAudioCacheTable).where(eq(trainingAudioCacheTable.scriptHash, scriptHash)).limit(1);
  if (cached) {
    res.setHeader("Cache-Control", "private, max-age=86400");
    res.setHeader("X-AI-Generated-Voice", "true");
    res.type(cached.contentType).send(Buffer.from(cached.audioBase64, "base64"));
    return;
  }
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) { res.status(503).json({ error: "Voice narration is unavailable. Captions remain available." }); return; }
  const started = Date.now();
  try {
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, voice, input: found.step.narration, instructions: "Speak in a warm, patient, confident, professional style. Use a natural pace, clear phrasing, and a welcoming East Tennessee business-training tone.", response_format: "mp3" }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`OpenAI speech request failed with status ${response.status}`);
    const audio = Buffer.from(await response.arrayBuffer());
    const now = new Date().toISOString();
    await db.insert(trainingAudioCacheTable).values({ id: randomUUID(), scriptHash, stepId: req.params.stepId, manifestVersion: TRAINING_MANIFEST_VERSION, model, voice, contentType: "audio/mpeg", audioBase64: audio.toString("base64"), createdAt: now }).onConflictDoNothing();
    await audit("training.narration.generated", { userId: req.auth!.userId, entityType: "training_audio", entityId: req.params.stepId, ip: req.ip, details: { model, voice, latencyMs: Date.now() - started } });
    res.setHeader("Cache-Control", "private, max-age=86400");
    res.setHeader("X-AI-Generated-Voice", "true");
    res.type("audio/mpeg").send(audio);
  } catch (error) {
    req.log.warn({ error, stepId: req.params.stepId }, "Training narration generation failed");
    res.status(503).json({ error: "Voice narration is temporarily unavailable. Continue with the visible captions and try Replay shortly." });
  }
});

router.get("/demo/reset/preview", requireOwner, async (_req, res) => {
  const origins = await db.select().from(demoRecordOriginsTable);
  const counts = origins.reduce<Record<string, number>>((acc, row) => { acc[row.entityType] = (acc[row.entityType] ?? 0) + 1; return acc; }, {});
  res.json({ demoRecords: counts, teamRecordsPreserved: true, transactional: true });
});

router.post("/demo/reset", requireOwner, async (req, res) => {
  const scope = String(req.body?.scope ?? "all");
  if (scope === "factory" && req.body?.confirmation !== "DELETE ALL DATA") { res.status(400).json({ error: "Type DELETE ALL DATA to confirm a factory reset" }); return; }
  await db.transaction(async (tx) => {
    if (scope === "factory") {
      await tx.delete(invoicesTable); await tx.delete(proposalsTable); await tx.delete(leadsTable); await tx.delete(jobsTable); await tx.delete(productsTable); await tx.delete(tourProgressTable); await tx.delete(trainingRunsTable); await tx.delete(trainingPreferencesTable); await tx.delete(trainingAudioCacheTable); await tx.delete(demoRecordOriginsTable);
    } else if (scope === "all") {
      const replace = async (table: any, rows: any[]) => { const ids = rows.map((row) => row.id); if (ids.length) await tx.delete(table).where(inArray(table.id, ids)); if (rows.length) await tx.insert(table).values(rows); };
      await replace(invoicesTable, SEED_INVOICES); await replace(proposalsTable, SEED_PROPOSALS); await replace(leadsTable, SEED_LEADS); await replace(jobsTable, SEED_JOBS); await replace(productsTable, SEED_PRODUCTS); await tx.delete(tourProgressTable); await tx.delete(trainingRunsTable); await tx.delete(trainingPreferencesTable);
    } else {
      const heroIndex: Record<string, string> = { "residential-lvp": "1", "pet-carpet": "2", "hardwood-risk": "3", "commercial-lvt": "4" };
      const jobId = heroIndex[scope];
      if (!jobId) throw new Error("Unknown demo scenario");
      const job = SEED_JOBS.filter((row) => row.id === jobId); const proposals = SEED_PROPOSALS.filter((row) => row.jobId === jobId); const invoices = SEED_INVOICES.filter((row) => row.jobId === jobId);
      if (invoices.length) { await tx.delete(invoicesTable).where(inArray(invoicesTable.id, invoices.map((row) => row.id))); await tx.insert(invoicesTable).values(invoices); }
      if (proposals.length) { await tx.delete(proposalsTable).where(inArray(proposalsTable.id, proposals.map((row) => row.id))); await tx.insert(proposalsTable).values(proposals); }
      await tx.delete(jobsTable).where(eq(jobsTable.id, jobId)); await tx.insert(jobsTable).values(job); await tx.delete(tourProgressTable).where(eq(tourProgressTable.missionKey, scope));
    }
    await tx.insert(auditEventsTable).values({ id: randomUUID(), actorUserId: req.auth!.userId, action: "demo.reset", entityType: "demo", entityId: scope, details: { scope, teamRecordsPreserved: scope !== "factory" }, createdAt: new Date().toISOString(), ipAddress: req.ip ?? "" });
  });
  res.json({ ok: true, scope, teamRecordsPreserved: scope !== "factory", message: scope === "factory" ? "All business data was removed." : "Curated records and training progress were restored from the active baseline." });
});

export default router;
