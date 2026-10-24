import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { recoveryReadOnly } from "./recovery";

const app = express().use("/api", recoveryReadOnly, (_req, res) => res.json({ reached: true }));
describe("read-only recovery boundary", () => {
  beforeEach(() => { vi.stubEnv("READ_ONLY_RECOVERY", "true"); });
  afterEach(() => { vi.unstubAllEnvs(); });
  it("keeps authentication and business reads available", async () => {
    for (const path of ["/jobs", "/customers/one", "/jobs/one/labor", "/healthz", "/auth/session"]) expect((await request(app).get(`/api${path}`)).status).toBe(200);
    expect((await request(app).post("/api/auth/login")).status).toBe(200);
    expect((await request(app).post("/api/auth/logout")).status).toBe(200);
  });
  it("blocks business mutations, demo entry, role switching and integration side effects", async () => {
    for (const path of ["/jobs", "/inventory/movements", "/auth/demo", "/auth/persona"]) {
      const response = await request(app).post(`/api${path}`); expect(response.status).toBe(503); expect(response.body.code).toBe("READ_ONLY_RECOVERY");
    }
    expect((await request(app).patch("/api/settings")).status).toBe(503);
    expect((await request(app).delete("/api/products/one")).status).toBe(503);
    for (const path of ["/quickbooks/connect", "/google-calendar/status", "/public/quotes/token", "/ai/estimate"]) expect((await request(app).get(`/api${path}`)).status).toBe(503);
  });
  it("does not affect the normal release", async () => {
    vi.stubEnv("READ_ONLY_RECOVERY", "false");
    expect((await request(app).post("/api/jobs")).status).toBe(200);
  });
});
