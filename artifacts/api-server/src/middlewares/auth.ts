import type { NextFunction, Request, Response } from "express";
import { getSession, SESSION_COOKIE } from "../lib/auth";
import type { AppRole } from "@workspace/db";

declare global {
  namespace Express {
    interface Request { auth?: { userId: string; email: string; name: string; role: AppRole; actualRole: AppRole; previewRole: AppRole | null; csrfToken: string }; rawBody?: Buffer }
  }
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const found = await getSession(req.cookies?.[SESSION_COOKIE]);
  if (!found) { res.status(401).json({ error: "Authentication required" }); return; }
  const actualRole = found.user.role as AppRole;
  const previewRole = actualRole === "owner" ? (found.session.previewRole as AppRole | null) : null;
  req.auth = { userId: found.user.id, email: found.user.email, name: found.user.name, role: previewRole ?? actualRole, actualRole, previewRole, csrfToken: found.session.csrfToken };
  if (!SAFE_METHODS.has(req.method) && req.get("x-csrf-token") !== found.session.csrfToken) {
    res.status(403).json({ error: "Invalid CSRF token" }); return;
  }
  next();
}

export function requireRole(...roles: AppRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      res.status(403).json({ error: "You do not have permission to perform this action" });
      return;
    }
    next();
  };
}

export function requireOwner(req: Request, res: Response, next: NextFunction) {
  if (req.auth?.actualRole !== "owner" || req.auth.previewRole) {
    res.status(403).json({ error: "Exit role preview to use owner controls" });
    return;
  }
  next();
}

const ROLE_PREFIXES: Record<AppRole, string[]> = {
  owner: ["/"],
  sales: ["/demo", "/ai", "/leads", "/measurements", "/products", "/proposals", "/salespeople", "/communications", "/tasks", "/jobs", "/settings"],
  operations: ["/demo", "/jobs", "/photos", "/job-materials", "/labor-entries", "/material-usage", "/materials", "/products", "/tasks", "/measurements", "/google-calendar", "/integrations"],
  installer: ["/demo", "/jobs", "/photos", "/labor-entries", "/material-usage", "/tasks", "/storage", "/integrations"],
};

export function enforceRoleAccess(req: Request, res: Response, next: NextFunction) {
  const role = req.auth!.role;
  if (role === "owner" || ROLE_PREFIXES[role].some((prefix) => req.path === prefix || req.path.startsWith(`${prefix}/`))) { next(); return; }
  res.status(403).json({ error: `This area is unavailable in ${role} preview` });
}
