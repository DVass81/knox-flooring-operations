import { afterEach, describe, expect, it, vi } from "vitest";
import { businessDate, inReportingPeriod, recordedJobDate } from "./reporting";

afterEach(() => vi.useRealTimers());
describe("recorded reporting dates", () => {
  it("does not substitute record edits or planned dates for business events", () => {
    expect(recordedJobDate({ stageHistory: [] }, "sold")).toBeNull();
    expect(recordedJobDate({ stageHistory: [{ stage: "Scheduled", at: "2026-10-20T12:00:00Z" }] }, "completed")).toBeNull();
  });
  it("uses the first recorded approval and most recent completion unless explicitly set", () => {
    const job = { soldAt: null, completedAt: null, stageHistory: [{ stage: "Approved" as const, at: "2026-10-05T12:00:00Z" }, { stage: "Approved" as const, at: "2026-10-01T12:00:00Z" }, { stage: "Completed" as const, at: "2026-10-12T12:00:00Z" }, { stage: "Completed" as const, at: "2026-10-14T12:00:00Z" }] };
    expect(recordedJobDate(job, "sold")).toBe("2026-10-01T12:00:00Z");
    expect(recordedJobDate(job, "completed")).toBe("2026-10-14T12:00:00Z");
    expect(recordedJobDate({ ...job, soldAt: "2026-09-30T12:00:00Z" }, "sold")).toBe("2026-09-30T12:00:00Z");
  });
  it("keeps date filtering in the business timezone at midnight and across DST", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-23T12:00:00Z"));
    expect(businessDate(new Date("2026-10-01T02:00:00Z"))).toBe("2026-09-30");
    expect(inReportingPeriod("2026-10-01T02:00:00Z", "month")).toBe(false);
    expect(inReportingPeriod("2026-10-23T23:59:00-04:00", "custom", "2026-10-01", "2026-10-23")).toBe(true);
    expect(inReportingPeriod("2026-10-24T00:00:00-04:00", "custom", "2026-10-01", "2026-10-23")).toBe(false);
    expect(businessDate(new Date("2026-11-02T04:30:00Z"))).toBe("2026-11-01");
    expect(inReportingPeriod(null, "all")).toBe(false);
  });
});
