import type { NextFunction, Request, Response } from "express";
import { getSession, SESSION_COOKIE } from "../lib/auth";

declare global {
  namespace Express {
    interface Request { auth?: { userId: string; email: string; name: string; role: string; csrfToken: string }; rawBody?: Buffer }
  }
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const found = await getSession(req.cookies?.[SESSION_COOKIE]);
  if (!found) { res.status(401).json({ error: "Authentication required" }); return; }
  req.auth = { userId: found.user.id, email: found.user.email, name: found.user.name, role: found.user.role, csrfToken: found.session.csrfToken };
  if (!SAFE_METHODS.has(req.method) && req.get("x-csrf-token") !== found.session.csrfToken) {
    res.status(403).json({ error: "Invalid CSRF token" }); return;
  }
  next();
}
