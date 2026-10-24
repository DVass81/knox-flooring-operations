import { describe, expect, it } from "vitest";
import {
  assertBooking,
  assertRevision,
  DomainError,
  eventDate,
  movementDelta,
  overlaps,
  stockAvailability,
  withinPeriod,
} from "./operations-rules";

describe("inventory accounting rules", () => {
  it("subtracts only active reservations and preserves fractional stock", () => {
    expect(
      stockAvailability(23.64, [
        { quantity: 10.1, status: "Active" },
        { quantity: 5, status: "Released" },
        { quantity: 7, status: "Consumed" },
      ]),
    ).toEqual({ onHand: 23.64, reserved: 10.1, available: 13.54 });
  });
  it("keeps shortages visible instead of clamping them away", () => {
    expect(
      stockAvailability(4, [{ quantity: 7, status: "Active" }]).available,
    ).toBe(-3);
  });
  it("makes consumption negative and receipts/returns positive", () => {
    expect(movementDelta("consume", 8)).toBe(-8);
    expect(movementDelta("receipt", 8)).toBe(8);
    expect(movementDelta("return", 8)).toBe(8);
    expect(movementDelta("adjustment", -8)).toBe(-8);
  });
  it.each([0, Number.NaN, Number.POSITIVE_INFINITY, -2])(
    "rejects invalid receipt quantity %s",
    (quantity) => {
      expect(() => movementDelta("receipt", quantity)).toThrow(DomainError);
    },
  );
});
describe("crew booking rules", () => {
  const booking = {
    startAt: "2026-10-20T08:00:00-04:00",
    endAt: "2026-10-20T12:00:00-04:00",
  };
  it("does not double-book overlapping commitments", () => {
    expect(
      overlaps(booking, {
        startAt: "2026-10-20T11:00:00-04:00",
        endAt: "2026-10-20T13:00:00-04:00",
      }),
    ).toBe(true);
  });
  it("allows adjacent commitments and jobs on another week", () => {
    expect(
      overlaps(booking, {
        startAt: booking.endAt,
        endAt: "2026-10-20T17:00:00-04:00",
      }),
    ).toBe(false);
    expect(
      overlaps(booking, {
        startAt: "2026-10-27T08:00:00-04:00",
        endAt: "2026-10-27T12:00:00-04:00",
      }),
    ).toBe(false);
  });
  it("compares instants across timezone representations", () => {
    expect(
      overlaps(booking, {
        startAt: "2026-10-20T13:00:00Z",
        endAt: "2026-10-20T14:00:00Z",
      }),
    ).toBe(true);
  });
  it("requires a forward interval and positive person-hours", () => {
    expect(assertBooking({ ...booking, plannedLaborHours: 8 })).toBe(4);
    expect(() =>
      assertBooking({
        startAt: booking.endAt,
        endAt: booking.startAt,
        plannedLaborHours: 8,
      }),
    ).toThrow();
    expect(() => assertBooking({ ...booking, plannedLaborHours: 0 })).toThrow();
  });
});
describe("event-based reporting", () => {
  it("uses approval history, never an unrelated edit date", () => {
    const job = {
      stageHistory: [
        { stage: "Approved", at: "2026-09-10T15:00:00Z" },
        { stage: "Completed", at: "2026-10-02T15:00:00Z" },
      ],
      updatedAt: "2026-10-23T12:00:00Z",
    };
    expect(eventDate(job, "sold")).toBe("2026-09-10T15:00:00Z");
    expect(
      withinPeriod(
        eventDate(job, "sold"),
        "2026-10-01T00:00:00Z",
        "2026-11-01T00:00:00Z",
      ),
    ).toBe(false);
  });
  it("keeps unknown historical dates unknown", () => {
    expect(
      eventDate(
        { stageHistory: [{ stage: "Scheduled", at: "2026-09-01" }] },
        "sold",
      ),
    ).toBeNull();
  });
  it("uses first approval and latest recorded completion", () => {
    const job = {
      stageHistory: [
        { stage: "Approved", at: "2026-09-01" },
        { stage: "Completed", at: "2026-09-12" },
        { stage: "Approved", at: "2026-10-01" },
        { stage: "Completed", at: "2026-10-02" },
      ],
    };
    expect(eventDate(job, "sold")).toBe("2026-09-01");
    expect(eventDate(job, "completed")).toBe("2026-10-02");
  });
  it("uses inclusive start and exclusive end", () => {
    expect(withinPeriod("2026-10-01", "2026-10-01", "2026-11-01")).toBe(true);
    expect(withinPeriod("2026-11-01", "2026-10-01", "2026-11-01")).toBe(false);
    expect(withinPeriod(null, "2026-10-01", "2026-11-01")).toBe(false);
  });
});
describe("concurrent edit protection", () => {
  it("rejects a stale revision without accepting the update", () => {
    expect(() => assertRevision(3, 2)).toThrowError(
      "This record changed. Refresh before saving.",
    );
    expect(() => assertRevision(3, 3)).not.toThrow();
  });
});
