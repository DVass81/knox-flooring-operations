import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ ready: vi.fn(), pool: {} }));
vi.mock("@workspace/db", () => ({ assertMigrationsApplied: mocks.ready, pool: mocks.pool }));
import healthRouter from "./health";

const app = express().use("/api", healthRouter);
describe("deployment readiness", () => {
  beforeEach(() => { mocks.ready.mockReset(); });
  it("reports healthy only after checking the expected database migration version", async () => {
    mocks.ready.mockResolvedValue(undefined);
    const response = await request(app).get("/api/healthz");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
    expect(mocks.ready).toHaveBeenCalledWith(mocks.pool);
  });
  it("returns unavailable without exposing database details on failed readiness", async () => {
    mocks.ready.mockRejectedValue(new Error("private database connection details"));
    const response = await request(app).get("/api/healthz");
    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: "unavailable" });
    expect(response.text).not.toContain("private");
  });
});
