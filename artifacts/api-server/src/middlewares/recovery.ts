import type { NextFunction, Request, Response } from "express";

const readable = new Set(["jobs", "photos", "leads", "materials", "proposals", "salespeople", "invoices", "products", "settings", "tasks", "customers", "crews", "bookings", "callbacks", "inventory", "estimate-drafts", "metrics", "workspace-brand", "communications"]);
/** Recovery retains real authentication but pauses every business mutation and integration. */
export function recoveryReadOnly(req: Request, res: Response, next: NextFunction) {
  if (process.env.READ_ONLY_RECOVERY !== "true") { next(); return; }
  res.setHeader("X-Catalyst-Mode", "read-only-recovery");
  const read = req.method === "GET" || req.method === "HEAD";
  const root = req.path.split("/").filter(Boolean)[0];
  if ((read && (req.path === "/healthz" || req.path === "/auth/session" || readable.has(root))) || (req.method === "POST" && ["/auth/login", "/auth/logout"].includes(req.path))) { next(); return; }
  res.status(503).json({ code: "READ_ONLY_RECOVERY", error: "Catalyst Works is in read-only recovery. Records are available to view; changes and integrations are paused." });
}
