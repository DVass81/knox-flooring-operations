import { createHash, randomBytes, randomUUID } from "node:crypto";
import argon2 from "argon2";
import { and, eq, gt } from "drizzle-orm";
import { auditEventsTable, db, sessionsTable, usersTable } from "@workspace/db";

export const SESSION_COOKIE = "knox_session";
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const newToken = () => randomBytes(32).toString("base64url");
export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 3, parallelism: 1 });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try { return await argon2.verify(hash, password); } catch { return false; }
}

export async function createSession(userId: string, ipAddress = "", userAgent = "") {
  const token = newToken();
  const csrfToken = newToken();
  const now = new Date();
  await db.insert(sessionsTable).values({
    id: randomUUID(), userId, tokenHash: hashToken(token), csrfToken,
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS).toISOString(),
    ipAddress, userAgent: userAgent.slice(0, 500), createdAt: now.toISOString(),
  });
  return { token, csrfToken };
}

export async function getSession(token?: string) {
  if (!token) return null;
  const [row] = await db.select({ session: sessionsTable, user: usersTable })
    .from(sessionsTable).innerJoin(usersTable, eq(sessionsTable.userId, usersTable.id))
    .where(and(eq(sessionsTable.tokenHash, hashToken(token)), gt(sessionsTable.expiresAt, new Date().toISOString()), eq(usersTable.active, true))).limit(1);
  return row ?? null;
}

export async function audit(action: string, input: { userId?: string; entityType?: string; entityId?: string; ip?: string; details?: Record<string, unknown> } = {}) {
  await db.insert(auditEventsTable).values({ id: randomUUID(), actorUserId: input.userId, action,
    entityType: input.entityType ?? "system", entityId: input.entityId, ipAddress: input.ip ?? "",
    details: input.details ?? {}, createdAt: new Date().toISOString() });
}
