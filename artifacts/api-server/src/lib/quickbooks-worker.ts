import { createHash, randomUUID } from "node:crypto";
import { and, asc, eq, inArray, lte } from "drizzle-orm";
import { db, invoicesTable, jobsTable, productsTable, proposalsTable, quickbooksConnectionsTable, quickbooksConflictsTable, quickbooksEntityMappingsTable, quickbooksSyncJobsTable, quickbooksWebhookEventsTable } from "@workspace/db";
import { audit } from "./auth";
import { getConnection, qboRequest } from "./quickbooks";
import { logger } from "./logger";

const fingerprint = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
async function mapping(entityType: string, localId: string) { const [row] = await db.select().from(quickbooksEntityMappingsTable).where(and(eq(quickbooksEntityMappingsTable.entityType, entityType), eq(quickbooksEntityMappingsTable.localId, localId))).limit(1); return row; }

async function saveMapping(entityType: string, localId: string, entity: any) {
  const now = new Date().toISOString(); const existing = await mapping(entityType, localId);
  const values = { quickbooksId: String(entity.Id), syncToken: String(entity.SyncToken ?? "0"), fingerprint: fingerprint(entity), status: "linked", lastSyncedAt: now, lastError: null, updatedAt: now };
  if (existing) await db.update(quickbooksEntityMappingsTable).set(values).where(eq(quickbooksEntityMappingsTable.id, existing.id));
  else await db.insert(quickbooksEntityMappingsTable).values({ id: randomUUID(), entityType, localId, ...values, createdAt: now });
}

async function exportJob(job: typeof quickbooksSyncJobsTable.$inferSelect) {
  if (job.entityType === "customer" || job.entityType === "project") {
    const [source] = await db.select().from(jobsTable).where(eq(jobsTable.id, job.localId)).limit(1); if (!source) throw new Error("Local job not found");
    const parent = job.entityType === "project" ? await mapping("customer", source.id) : null;
    const payload: any = job.entityType === "customer" ? { DisplayName: source.customerName, PrimaryEmailAddr: source.email ? { Address: source.email } : undefined, PrimaryPhone: source.phone ? { FreeFormNumber: source.phone } : undefined, BillAddr: { Line1: source.address, City: source.city } } : { DisplayName: `${source.jobNumber} - ${source.customerName}`, Job: true, ParentRef: parent ? { value: parent.quickbooksId } : undefined };
    if (job.entityType === "project" && !parent) throw new Error("Customer must be linked before its project");
    const existing = await mapping(job.entityType, source.id); if (existing) Object.assign(payload, { Id: existing.quickbooksId, SyncToken: existing.syncToken, sparse: true });
    const result = await qboRequest("/customer", { method: "POST", body: JSON.stringify(payload) }); await saveMapping(job.entityType, source.id, result.Customer);
  } else if (job.entityType === "invoice") {
    const [source] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, job.localId)).limit(1); if (!source) throw new Error("Local invoice not found");
    const customer = await mapping("customer", source.jobId); if (!customer) throw new Error("Customer mapping is required");
    const payload: any = { CustomerRef: { value: customer.quickbooksId }, DocNumber: source.invoiceNumber, TxnDate: source.issueDate || undefined, DueDate: source.dueDate || undefined, PrivateNote: source.notes || undefined, Line: source.lineItems.map((line, i) => ({ Id: String(i + 1), Amount: Math.round(line.quantity * line.unitPrice * 100) / 100, DetailType: "SalesItemLineDetail", Description: line.description, SalesItemLineDetail: { Qty: line.quantity, UnitPrice: line.unitPrice } })) };
    const existing = await mapping("invoice", source.id); if (existing) Object.assign(payload, { Id: existing.quickbooksId, SyncToken: existing.syncToken, sparse: false });
    const result = await qboRequest("/invoice", { method: "POST", body: JSON.stringify(payload) }); await saveMapping("invoice", source.id, result.Invoice);
    if (source.depositAmount > 0) await qboRequest("/payment", { method: "POST", body: JSON.stringify({ CustomerRef: { value: customer.quickbooksId }, TotalAmt: source.depositAmount, Line: [{ Amount: source.depositAmount, LinkedTxn: [{ TxnId: result.Invoice.Id, TxnType: "Invoice" }] }] }) });
  } else if (job.entityType === "estimate") {
    const [source] = await db.select().from(proposalsTable).where(eq(proposalsTable.id, job.localId)).limit(1); if (!source) throw new Error("Local proposal not found");
    const customer = await mapping("customer", source.convertedJobId ?? source.id); if (!customer) throw new Error("Customer mapping is required");
    const payload: any = { CustomerRef: { value: customer.quickbooksId }, PrivateNote: source.scopeOfWork, Line: [{ Amount: source.estimatedPrice, DetailType: "SalesItemLineDetail", Description: source.flooringType, SalesItemLineDetail: { Qty: 1, UnitPrice: source.estimatedPrice } }] };
    const existing = await mapping("estimate", source.id); if (existing) Object.assign(payload, { Id: existing.quickbooksId, SyncToken: existing.syncToken });
    const result = await qboRequest("/estimate", { method: "POST", body: JSON.stringify(payload) }); await saveMapping("estimate", source.id, result.Estimate);
  } else if (job.entityType === "item") {
    const [source] = await db.select().from(productsTable).where(eq(productsTable.id, job.localId)).limit(1); if (!source) throw new Error("Local product not found");
    throw new Error(`Product ${source.name} needs an approved income-account mapping`);
  } else throw new Error(`Unsupported export entity: ${job.entityType}`);
}

export async function processQuickBooksQueue() {
  if (!await getConnection()) return;
  const now = new Date().toISOString();
  const rows = await db.select().from(quickbooksSyncJobsTable).where(and(inArray(quickbooksSyncJobsTable.status, ["approved", "retry"]), lte(quickbooksSyncJobsTable.nextAttemptAt, now))).orderBy(asc(quickbooksSyncJobsTable.createdAt)).limit(10);
  for (const row of rows) {
    const started = await db.update(quickbooksSyncJobsTable).set({ status: "processing", startedAt: now, attempts: row.attempts + 1, updatedAt: now }).where(and(eq(quickbooksSyncJobsTable.id, row.id), inArray(quickbooksSyncJobsTable.status, ["approved", "retry"]))).returning(); if (!started.length) continue;
    try { await exportJob(row); const done = new Date().toISOString(); await db.update(quickbooksSyncJobsTable).set({ status: "completed", completedAt: done, lastError: null, updatedAt: done }).where(eq(quickbooksSyncJobsTable.id, row.id)); await audit("quickbooks.sync_completed", { entityType: row.entityType, entityId: row.localId }); }
    catch (error) { const message = error instanceof Error ? error.message : String(error); const retryable = /429|timeout|temporar|network|fetch/i.test(message); const status = retryable && row.attempts < 5 ? "retry" : "failed"; const delay = Math.min(60, 2 ** (row.attempts + 1)) * 60_000; await db.update(quickbooksSyncJobsTable).set({ status, lastError: message, nextAttemptAt: new Date(Date.now() + delay).toISOString(), updatedAt: new Date().toISOString() }).where(eq(quickbooksSyncJobsTable.id, row.id)); logger.error({ error, jobId: row.id }, "QuickBooks sync failed"); }
  }
}

async function importInvoice(quickbooksId: string) {
  const result = await qboRequest(`/invoice/${quickbooksId}`); const remote = result.Invoice; if (!remote) return;
  const [link] = await db.select().from(quickbooksEntityMappingsTable).where(and(eq(quickbooksEntityMappingsTable.entityType, "invoice"), eq(quickbooksEntityMappingsTable.quickbooksId, quickbooksId))).limit(1); if (!link) return;
  const [local] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, link.localId)).limit(1); if (!local) return;
  const remoteUpdated = String(remote.MetaData?.LastUpdatedTime ?? "");
  if (link.lastSyncedAt && local.updatedAt > link.lastSyncedAt && remoteUpdated > link.lastSyncedAt) {
    const [existing] = await db.select().from(quickbooksConflictsTable).where(and(eq(quickbooksConflictsTable.entityType, "invoice"), eq(quickbooksConflictsTable.localId, local.id), eq(quickbooksConflictsTable.status, "open"))).limit(1);
    if (!existing) await db.insert(quickbooksConflictsTable).values({ id: randomUUID(), entityType: "invoice", localId: local.id, quickbooksId, localSnapshot: local as any, quickbooksSnapshot: remote, createdAt: new Date().toISOString() });
    return;
  }
  const total = Number(remote.TotalAmt ?? local.total); const balance = Number(remote.Balance ?? total); const paid = Math.max(0, total - balance); const now = new Date().toISOString();
  await db.update(invoicesTable).set({ total, paidAmount: paid, balanceAmount: balance, status: balance <= 0 ? "Paid" : paid > 0 || local.depositAmount > 0 ? "Partial" : local.status, paidAt: balance <= 0 ? now : local.paidAt, updatedAt: now }).where(eq(invoicesTable.id, local.id));
  await db.update(quickbooksEntityMappingsTable).set({ syncToken: String(remote.SyncToken ?? link.syncToken), fingerprint: fingerprint(remote), lastSyncedAt: now, updatedAt: now }).where(eq(quickbooksEntityMappingsTable.id, link.id));
}

async function processWebhookInbox() {
  const events = await db.select().from(quickbooksWebhookEventsTable).where(eq(quickbooksWebhookEventsTable.status, "received")).limit(25);
  for (const event of events) {
    try {
      const notifications = (event.payload as any)?.eventNotifications ?? [];
      for (const notification of notifications) for (const entity of notification?.dataChangeEvent?.entities ?? []) {
        if (entity.name === "Invoice") await importInvoice(String(entity.id));
        if (entity.name === "Payment") { const payment = (await qboRequest(`/payment/${entity.id}`)).Payment; const invoiceIds = new Set<string>(); for (const line of payment?.Line ?? []) for (const linked of line.LinkedTxn ?? []) if (linked.TxnType === "Invoice") invoiceIds.add(String(linked.TxnId)); for (const id of invoiceIds) await importInvoice(id); }
      }
      await db.update(quickbooksWebhookEventsTable).set({ status: "processed", processedAt: new Date().toISOString() }).where(eq(quickbooksWebhookEventsTable.id, event.id));
    } catch (error) { await db.update(quickbooksWebhookEventsTable).set({ status: "failed", lastError: error instanceof Error ? error.message : String(error) }).where(eq(quickbooksWebhookEventsTable.id, event.id)); }
  }
}

let lastCdcRun = 0;
async function pollChanges() {
  if (Date.now() - lastCdcRun < 5 * 60_000) return; lastCdcRun = Date.now(); const connection = await getConnection(); if (!connection) return;
  const changedSince = connection.lastCdcAt ?? new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  const result = await qboRequest(`/cdc?entities=Invoice,Payment&changedSince=${encodeURIComponent(changedSince)}`);
  for (const response of result.CDCResponse ?? []) for (const query of response.QueryResponse ?? []) for (const invoice of query.Invoice ?? []) await importInvoice(String(invoice.Id));
  const now = new Date().toISOString(); await db.update(quickbooksConnectionsTable).set({ lastCdcAt: now, lastSyncAt: now, updatedAt: now }).where(eq(quickbooksConnectionsTable.id, connection.id));
}

let timer: NodeJS.Timeout | undefined;
export function startQuickBooksWorker() { if (timer) return; timer = setInterval(() => Promise.all([processQuickBooksQueue(), processWebhookInbox(), pollChanges()]).catch((error) => logger.error({ error }, "QuickBooks worker failed")), 30_000); timer.unref(); }
