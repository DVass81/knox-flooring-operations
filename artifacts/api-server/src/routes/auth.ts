import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db, passwordResetTokensTable, sessionsTable, usersTable } from "@workspace/db";
import { audit, createSession, hashPassword, hashToken, newToken, normalizeEmail, SESSION_COOKIE, SESSION_TTL_MS, verifyPassword } from "../lib/auth";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();
const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: SESSION_TTL_MS };
const attempts = new Map<string, { count: number; resetAt: number }>();

router.post("/auth/login", async (req, res) => {
  const email = normalizeEmail(String(req.body?.email ?? ""));
  const password = String(req.body?.password ?? "");
  const key = `${req.ip}:${email}`;
  const rate = attempts.get(key);
  if (rate && rate.resetAt > Date.now() && rate.count >= 8) { res.status(429).json({ error: "Too many attempts. Try again later." }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  const locked = user?.lockedUntil && user.lockedUntil > new Date().toISOString();
  if (!user || !user.active || locked || !(await verifyPassword(user.passwordHash, password))) {
    const count = (rate?.resetAt ?? 0) > Date.now() ? rate!.count + 1 : 1;
    attempts.set(key, { count, resetAt: Date.now() + 15 * 60_000 });
    if (user) await db.update(usersTable).set({ failedLoginCount: user.failedLoginCount + 1, lockedUntil: user.failedLoginCount >= 7 ? new Date(Date.now() + 15 * 60_000).toISOString() : null }).where(eq(usersTable.id, user.id));
    await audit("auth.login_failed", { entityType: "user", entityId: user?.id, ip: req.ip, details: { email } });
    res.status(401).json({ error: "Invalid email or password" }); return;
  }
  attempts.delete(key);
  const session = await createSession(user.id, req.ip, req.get("user-agent") ?? "");
  await db.update(usersTable).set({ failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date().toISOString(), updatedAt: new Date().toISOString() }).where(eq(usersTable.id, user.id));
  res.cookie(SESSION_COOKIE, session.token, cookieOptions);
  await audit("auth.login", { userId: user.id, entityType: "user", entityId: user.id, ip: req.ip });
  res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role }, csrfToken: session.csrfToken });
});

router.get("/auth/session", requireAuth, (req, res) => res.json({ user: req.auth, csrfToken: req.auth!.csrfToken }));

router.post("/auth/logout", requireAuth, async (req, res) => {
  const token = req.cookies?.[SESSION_COOKIE];
  if (token) await db.delete(sessionsTable).where(eq(sessionsTable.tokenHash, hashToken(token)));
  res.clearCookie(SESSION_COOKIE, cookieOptions); await audit("auth.logout", { userId: req.auth!.userId, ip: req.ip }); res.status(204).end();
});

router.post("/auth/password/forgot", async (req, res) => {
  const email = normalizeEmail(String(req.body?.email ?? ""));
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (user?.active) {
    const token = newToken(); const now = new Date();
    await db.insert(passwordResetTokensTable).values({ id: randomUUID(), userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(now.getTime() + 30 * 60_000).toISOString(), createdAt: now.toISOString() });
    if (process.env.RESEND_API_KEY && process.env.APP_BASE_URL) {
      await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: process.env.RESEND_FROM_EMAIL ?? "Knox Ops <noreply@knoxflooring.com>", to: [email], subject: "Reset your Knox Ops password", html: `<p>A password reset was requested for Knox Ops.</p><p><a href="${process.env.APP_BASE_URL}/welcome?reset=${encodeURIComponent(token)}">Reset password</a></p><p>This link expires in 30 minutes.</p>` }) });
    }
    await audit("auth.password_reset_requested", { entityType: "user", entityId: user.id, ip: req.ip });
  }
  res.status(202).json({ message: "If that account exists, a reset email has been sent." });
});

router.post("/auth/password/reset", async (req, res) => {
  const token = String(req.body?.token ?? ""); const password = String(req.body?.password ?? "");
  if (password.length < 12) { res.status(400).json({ error: "Password must be at least 12 characters" }); return; }
  const [reset] = await db.select().from(passwordResetTokensTable).where(and(eq(passwordResetTokensTable.tokenHash, hashToken(token)), gt(passwordResetTokensTable.expiresAt, new Date().toISOString()), isNull(passwordResetTokensTable.usedAt))).limit(1);
  if (!reset) { res.status(400).json({ error: "Reset link is invalid or expired" }); return; }
  const now = new Date().toISOString();
  await db.transaction(async (tx) => { await tx.update(usersTable).set({ passwordHash: await hashPassword(password), updatedAt: now }).where(eq(usersTable.id, reset.userId)); await tx.update(passwordResetTokensTable).set({ usedAt: now }).where(eq(passwordResetTokensTable.id, reset.id)); await tx.delete(sessionsTable).where(eq(sessionsTable.userId, reset.userId)); });
  await audit("auth.password_reset", { entityType: "user", entityId: reset.userId, ip: req.ip }); res.status(204).end();
});

export async function bootstrapOwner() {
  const email = process.env.OWNER_EMAIL ? normalizeEmail(process.env.OWNER_EMAIL) : "";
  const password = process.env.OWNER_INITIAL_PASSWORD ?? "";
  if (!email || password.length < 12) return;
  const [existing] = await db.select({ id: usersTable.id }).from(usersTable).limit(1);
  if (existing) return;
  const now = new Date().toISOString();
  await db.insert(usersTable).values({ id: randomUUID(), email, passwordHash: await hashPassword(password), name: process.env.OWNER_NAME ?? "Owner", role: "owner", createdAt: now, updatedAt: now });
  await audit("auth.owner_bootstrapped", { entityType: "user", details: { email } });
}

export default router;
