import { createHash, randomUUID } from "node:crypto";
import { db, quickbooksSyncJobsTable } from "@workspace/db";

export async function queueQuickBooksReview(entityType: string, localId: string, action: string, payload: Record<string, unknown>, warnings: string[] = []) {
  const now = new Date().toISOString();
  const version = createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 20);
  await db.insert(quickbooksSyncJobsTable).values({ id: randomUUID(), idempotencyKey: `${entityType}:${localId}:${action}:${version}`, entityType, localId, action, status: "pending_approval", payload, warnings, nextAttemptAt: now, createdAt: now, updatedAt: now }).onConflictDoNothing();
}
