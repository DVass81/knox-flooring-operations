import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db, jobsTable, productsTable, quickbooksAccountingMappingsTable, quickbooksConflictsTable, quickbooksConnectionsTable, quickbooksEntityMappingsTable, quickbooksSyncJobsTable, quickbooksWebhookEventsTable } from "@workspace/db";
import { audit } from "../lib/auth";
import { encryptSecret, getConnection, qboQuery, signOAuthState, verifyOAuthState } from "../lib/quickbooks";
import { processQuickBooksQueue } from "../lib/quickbooks-worker";

const router: IRouter = Router();
const configured = () => Boolean(process.env.QUICKBOOKS_CLIENT_ID && process.env.QUICKBOOKS_CLIENT_SECRET && process.env.QUICKBOOKS_REDIRECT_URI && process.env.QUICKBOOKS_ENCRYPTION_KEY);
const publicConnection = (c: Awaited<ReturnType<typeof getConnection>>) => c ? ({ connected: c.status === "connected", status: c.status, realmId: c.realmId, companyName: c.companyName, environment: c.environment, readinessStatus: c.readinessStatus, lastSyncAt: c.lastSyncAt, lastCdcAt: c.lastCdcAt, refreshTokenExpiresAt: c.refreshTokenExpiresAt }) : ({ connected: false, status: configured() ? "not_connected" : "not_configured", readinessStatus: "configuration_required" });

router.get("/quickbooks/status", async (_req, res) => res.json({ configured: configured(), connection: publicConnection(await getConnection()) }));

router.get("/quickbooks/connect", async (req, res) => {
  if (!configured()) { res.status(503).json({ error: "QuickBooks environment variables are not configured" }); return; }
  const state = signOAuthState(`${req.auth!.userId}:${Date.now()}:${randomUUID()}`);
  res.cookie("qbo_oauth_state", state, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 10 * 60_000, path: "/" });
  const url = new URL("https://appcenter.intuit.com/connect/oauth2");
  url.searchParams.set("client_id", process.env.QUICKBOOKS_CLIENT_ID!); url.searchParams.set("response_type", "code"); url.searchParams.set("scope", "com.intuit.quickbooks.accounting"); url.searchParams.set("redirect_uri", process.env.QUICKBOOKS_REDIRECT_URI!); url.searchParams.set("state", state);
  res.json({ authorizationUrl: url.toString() });
});

router.get("/quickbooks/callback", async (req, res) => {
  const state = String(req.query.state ?? ""); const cookieState = String(req.cookies?.qbo_oauth_state ?? "");
  if (!verifyOAuthState(state) || state !== cookieState || !req.query.code || !req.query.realmId) { res.status(400).send("Invalid QuickBooks authorization response"); return; }
  const auth = Buffer.from(`${process.env.QUICKBOOKS_CLIENT_ID}:${process.env.QUICKBOOKS_CLIENT_SECRET}`).toString("base64");
  const response = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", { method: "POST", headers: { Authorization: `Basic ${auth}`, Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "authorization_code", code: String(req.query.code), redirect_uri: process.env.QUICKBOOKS_REDIRECT_URI! }) });
  if (!response.ok) { res.status(502).send("QuickBooks token exchange failed"); return; }
  const token = await response.json() as any; const now = new Date(); const realmId = String(req.query.realmId);
  await db.delete(quickbooksConnectionsTable);
  await db.insert(quickbooksConnectionsTable).values({ id: randomUUID(), realmId, environment: process.env.QUICKBOOKS_ENVIRONMENT === "production" ? "production" : "sandbox", encryptedAccessToken: encryptSecret(token.access_token), encryptedRefreshToken: encryptSecret(token.refresh_token), accessTokenExpiresAt: new Date(now.getTime() + token.expires_in * 1000).toISOString(), refreshTokenExpiresAt: new Date(now.getTime() + token.x_refresh_token_expires_in * 1000).toISOString(), status: "connected", readinessStatus: "reconciliation_required", createdAt: now.toISOString(), updatedAt: now.toISOString() });
  res.clearCookie("qbo_oauth_state", { path: "/" }); await audit("quickbooks.connected", { userId: req.auth!.userId, entityType: "quickbooks_company", entityId: realmId, ip: req.ip }); res.redirect("/settings?quickbooks=connected");
});

router.post("/quickbooks/disconnect", async (req, res) => { const c = await getConnection(); if (c) await db.update(quickbooksConnectionsTable).set({ status: "disconnected", encryptedAccessToken: encryptSecret("revoked"), encryptedRefreshToken: encryptSecret("revoked"), updatedAt: new Date().toISOString() }).where(eq(quickbooksConnectionsTable.id, c.id)); await audit("quickbooks.disconnected", { userId: req.auth!.userId, ip: req.ip }); res.status(204).end(); });

router.post("/quickbooks/reconcile", async (req, res) => {
  const entities = ["Customer", "Item", "TaxCode", "Account", "Employee", "Vendor"];
  const result: Record<string, unknown[]> = {};
  for (const entity of entities) { const body = await qboQuery(`select * from ${entity} maxresults 1000`); result[entity.toLowerCase()] = body.QueryResponse?.[entity] ?? []; }
  const c = await getConnection(); if (c) await db.update(quickbooksConnectionsTable).set({ lastSyncAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(eq(quickbooksConnectionsTable.id, c.id));
  const localJobs = await db.select().from(jobsTable); const localProducts = await db.select().from(productsTable); const norm = (v: unknown) => String(v ?? "").trim().toLowerCase().replace(/[^a-z0-9@]/g, "");
  const customers = result.customer as any[]; const items = result.item as any[];
  const candidates = [
    ...localJobs.map(local => { const matches = customers.filter(remote => norm(remote.PrimaryEmailAddr?.Address) === norm(local.email) || norm(remote.PrimaryPhone?.FreeFormNumber) === norm(local.phone) || norm(remote.DisplayName) === norm(local.customerName)); return { entityType: "customer", localId: local.id, localName: local.customerName, matches: matches.map(m => ({ id: String(m.Id), name: m.DisplayName, confidence: norm(m.PrimaryEmailAddr?.Address) === norm(local.email) && Boolean(local.email) ? "exact" : "suggested" })) }; }),
    ...localProducts.map(local => { const matches = items.filter(remote => norm(remote.Name) === norm(local.name) || (local.sku && norm(remote.Sku) === norm(local.sku))); return { entityType: "item", localId: local.id, localName: local.name, matches: matches.map(m => ({ id: String(m.Id), name: m.Name, confidence: "exact" })) }; }),
  ];
  await audit("quickbooks.reconciliation_loaded", { userId: req.auth!.userId, details: Object.fromEntries(Object.entries(result).map(([k, v]) => [k, v.length])) }); res.json({ lists: result, candidates });
});

router.get("/quickbooks/mappings", async (_req, res) => res.json({ entities: await db.select().from(quickbooksEntityMappingsTable), accounting: await db.select().from(quickbooksAccountingMappingsTable) }));
router.put("/quickbooks/entity-mappings/:entityType/:localId", async (req, res) => {
  const entityType = String(req.params.entityType); const localId = String(req.params.localId); const decision = String(req.body?.decision ?? "link"); const quickbooksId = String(req.body?.quickbooksId ?? "");
  if (!quickbooksId && decision === "link") { res.status(400).json({ error: "quickbooksId is required to link a record" }); return; }
  const now = new Date().toISOString(); const [existing] = await db.select().from(quickbooksEntityMappingsTable).where(and(eq(quickbooksEntityMappingsTable.entityType, entityType), eq(quickbooksEntityMappingsTable.localId, localId))).limit(1);
  const values = { quickbooksId: quickbooksId || "ignored", status: decision === "ignore" ? "ignored" : "linked", syncToken: String(req.body?.syncToken ?? "0"), fingerprint: "", lastError: null, updatedAt: now };
  const [saved] = existing ? await db.update(quickbooksEntityMappingsTable).set(values).where(eq(quickbooksEntityMappingsTable.id, existing.id)).returning() : await db.insert(quickbooksEntityMappingsTable).values({ id: randomUUID(), entityType, localId, ...values, createdAt: now }).returning();
  await audit("quickbooks.entity_reconciled", { userId: req.auth!.userId, entityType, entityId: localId, details: { decision, quickbooksId } }); res.json(saved);
});
router.put("/quickbooks/mappings/:type/:key", async (req, res) => {
  const mappingType = String(req.params.type); const localKey = String(req.params.key); const quickbooksId = String(req.body?.quickbooksId ?? ""); if (!quickbooksId) { res.status(400).json({ error: "quickbooksId is required" }); return; }
  const now = new Date().toISOString(); const [existing] = await db.select().from(quickbooksAccountingMappingsTable).where(and(eq(quickbooksAccountingMappingsTable.mappingType, mappingType), eq(quickbooksAccountingMappingsTable.localKey, localKey))).limit(1);
  const values = { quickbooksId, quickbooksName: String(req.body?.quickbooksName ?? ""), approved: Boolean(req.body?.approved), metadata: req.body?.metadata ?? {}, updatedAt: now };
  const [saved] = existing ? await db.update(quickbooksAccountingMappingsTable).set(values).where(eq(quickbooksAccountingMappingsTable.id, existing.id)).returning() : await db.insert(quickbooksAccountingMappingsTable).values({ id: randomUUID(), mappingType, localKey, ...values, createdAt: now }).returning();
  await audit("quickbooks.mapping_saved", { userId: req.auth!.userId, entityType: mappingType, entityId: localKey }); res.json(saved);
});

router.get("/quickbooks/queue", async (_req, res) => res.json(await db.select().from(quickbooksSyncJobsTable).orderBy(desc(quickbooksSyncJobsTable.createdAt)).limit(250)));
router.post("/quickbooks/queue", async (req, res) => {
  const entityType = String(req.body?.entityType ?? ""); const localId = String(req.body?.localId ?? ""); const action = String(req.body?.action ?? "upsert"); if (!entityType || !localId || !["customer", "project", "estimate", "invoice", "item", "labor", "expense"].includes(entityType)) { res.status(400).json({ error: "Valid entityType and localId are required" }); return; }
  const now = new Date().toISOString(); const version = createHash("sha256").update(JSON.stringify(req.body?.payload ?? {})).digest("hex").slice(0, 16); const [created] = await db.insert(quickbooksSyncJobsTable).values({ id: randomUUID(), idempotencyKey: `${entityType}:${localId}:${action}:${version}`, entityType, localId, action, payload: req.body?.payload ?? {}, warnings: req.body?.warnings ?? [], status: "pending_approval", nextAttemptAt: now, createdAt: now, updatedAt: now }).onConflictDoNothing().returning(); res.status(created ? 201 : 200).json(created ?? { duplicate: true });
});
router.post("/quickbooks/queue/approve", async (req, res) => { const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : []; if (!ids.length) { res.status(400).json({ error: "ids are required" }); return; } const now = new Date().toISOString(); const changed = await db.update(quickbooksSyncJobsTable).set({ status: "approved", approvedBy: req.auth!.userId, approvedAt: now, nextAttemptAt: now, updatedAt: now }).where(and(inArray(quickbooksSyncJobsTable.id, ids), eq(quickbooksSyncJobsTable.status, "pending_approval"))).returning(); await audit("quickbooks.sync_approved", { userId: req.auth!.userId, details: { ids } }); void processQuickBooksQueue(); res.json(changed); });
router.post("/quickbooks/queue/:id/retry", async (req, res) => { const now = new Date().toISOString(); const [row] = await db.update(quickbooksSyncJobsTable).set({ status: "retry", nextAttemptAt: now, lastError: null, updatedAt: now }).where(eq(quickbooksSyncJobsTable.id, String(req.params.id))).returning(); if (!row) { res.status(404).json({ error: "Sync job not found" }); return; } void processQuickBooksQueue(); res.json(row); });

router.get("/quickbooks/conflicts", async (_req, res) => res.json(await db.select().from(quickbooksConflictsTable).orderBy(desc(quickbooksConflictsTable.createdAt))));
router.post("/quickbooks/conflicts/:id/resolve", async (req, res) => { const resolution = String(req.body?.resolution ?? ""); if (!["keep_knox", "accept_quickbooks"].includes(resolution)) { res.status(400).json({ error: "Invalid resolution" }); return; } const now = new Date().toISOString(); const [row] = await db.update(quickbooksConflictsTable).set({ status: "resolved", resolution, resolvedBy: req.auth!.userId, resolvedAt: now }).where(eq(quickbooksConflictsTable.id, String(req.params.id))).returning(); await audit("quickbooks.conflict_resolved", { userId: req.auth!.userId, entityType: row?.entityType, entityId: row?.localId, details: { resolution } }); res.json(row); });

export async function quickBooksWebhook(req: any, res: any) {
  const verifier = process.env.QUICKBOOKS_WEBHOOK_VERIFIER; if (!verifier) { res.status(503).end(); return; }
  const signature = String(req.get("intuit-signature") ?? ""); const expected = createHmac("sha256", verifier).update(req.rawBody ?? Buffer.from(JSON.stringify(req.body))).digest("base64");
  if (!signature || signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) { res.status(401).end(); return; }
  const eventKey = createHash("sha256").update(req.rawBody ?? Buffer.from(JSON.stringify(req.body))).digest("hex"); const realmId = String(req.body?.eventNotifications?.[0]?.realmId ?? "");
  await db.insert(quickbooksWebhookEventsTable).values({ id: randomUUID(), eventKey, realmId, payload: req.body, receivedAt: new Date().toISOString() }).onConflictDoNothing(); res.status(200).end();
}

export default router;
