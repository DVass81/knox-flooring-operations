import { Router } from "express";
import { z } from "zod";
import { eq } from "drizzle-orm";
import {
  db,
  jobsTable,
  invoicesTable,
  crewsTable,
  crewBookingsTable,
  jobCallbacksTable,
  laborEntriesTable,
  settingsTable,
} from "@workspace/db";
import { requireRole } from "../middlewares/auth";
import { domainRoute, parse, revision, id } from "../lib/domain-http";
import { eventDate, withinPeriod, DomainError } from "../lib/operations-rules";
import {
  jobReadiness,
  updateJobWithReadiness,
  JOB_STAGES,
} from "../lib/job-readiness";
import { convertLead } from "../lib/conversions";

const router = Router();
router.get(
  "/workspace-brand",
  domainRoute(async (_req, res) => {
    const [s] = await db.select().from(settingsTable).limit(1);
    res.json({
      companyName: s?.companyName ?? "",
      companyLogoUrl: s?.companyLogoUrl ?? null,
      customerAccentColor: s?.customerAccentColor ?? "#7B00F5",
      phone: s?.phone ?? "",
      email: s?.email ?? "",
      website: s?.website ?? "",
      address: s?.address ?? "",
    });
  }),
);
router.post(
  "/leads/:id/convert",
  requireRole("owner", "sales"),
  domainRoute(async (req, res) => {
    const data = parse(
      z.object({ revision: revision.optional() }),
      req.body ?? {},
    );
    res.json(
      await db.transaction((tx) => convertLead(tx, id(req), data.revision)),
    );
  }),
);
router.get(
  "/jobs/:id/readiness",
  domainRoute(async (req, res) => {
    const stage = String(req.query.targetStage ?? "Scheduled");
    res.json(await db.transaction((tx) => jobReadiness(tx, id(req), stage)));
  }),
);
router.get(
  "/jobs/:id/entry-context",
  domainRoute(async (req, res) => {
    if (
      !(
        await db
          .select({ id: jobsTable.id })
          .from(jobsTable)
          .where(eq(jobsTable.id, id(req)))
      )[0]
    )
      throw new DomainError(404, "Job not found");
    const [crews, bookings, callbacks] = await Promise.all([
      db.select().from(crewsTable),
      db
        .select()
        .from(crewBookingsTable)
        .where(eq(crewBookingsTable.jobId, id(req))),
      db
        .select()
        .from(jobCallbacksTable)
        .where(eq(jobCallbacksTable.jobId, id(req))),
    ]);
    res.json({
      crews: crews
        .filter((c) =>
          req.auth!.role === "installer"
            ? bookings.some((b) => b.crewId === c.id)
            : c.active || bookings.some((b) => b.crewId === c.id),
        )
        .map((c) => ({ id: c.id, name: c.name })),
      bookings: bookings.map((b) => ({
        id: b.id,
        crewId: b.crewId,
        startAt: b.startAt,
        endAt: b.endAt,
        status: b.status,
      })),
      callbacks: callbacks.map((c) => ({
        id: c.id,
        reason: c.reason,
        status: c.status,
      })),
    });
  }),
);
router.post(
  "/jobs/:id/transition",
  domainRoute(async (req, res) => {
    const data = parse(
      z.object({
        revision,
        targetStage: z.string().refine((v) => JOB_STAGES.includes(v)),
        overrideReason: z.string().trim().min(1).max(2000).optional(),
        completionChecklist: z.record(z.string(), z.boolean()).optional(),
      }),
      req.body,
    );
    res.json(
      await db.transaction((tx) =>
        updateJobWithReadiness(
          tx,
          id(req),
          {
            status: data.targetStage,
            ...(data.completionChecklist
              ? { completionChecklist: data.completionChecklist }
              : {}),
          },
          req.auth!,
          data.revision,
          data.overrideReason,
        ),
      ),
    );
  }),
);
function boundary(value: string, end = false) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    // Convert midnight in the business timezone, including daylight-saving offsets.
    const wall = Date.parse(value + "T00:00:00Z");
    if (
      !Number.isFinite(wall) ||
      new Date(wall).toISOString().slice(0, 10) !== value
    )
      throw new DomainError(400, "Use a valid calendar date.");
    let result = wall;
    for (let i = 0; i < 2; i++) {
      const offset =
        new Intl.DateTimeFormat("en-US", {
          timeZone: "America/New_York",
          timeZoneName: "longOffset",
        })
          .formatToParts(new Date(result))
          .find((p) => p.type === "timeZoneName")?.value ?? "GMT";
      const match = /GMT([+-])(\d{2}):(\d{2})/.exec(offset);
      const minutes = match
        ? (Number(match[2]) * 60 + Number(match[3])) *
          (match[1] === "+" ? 1 : -1)
        : 0;
      result = wall - minutes * 60000;
    }
    return new Date(result).toISOString();
  }
  if (!Number.isFinite(Date.parse(value)))
    throw new DomainError(400, "Use valid from/to dates.");
  return new Date(value).toISOString();
}
router.get(
  "/metrics",
  requireRole("owner"),
  domainRoute(async (req, res) => {
    const today = new Date();
    const monthParts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
    }).formatToParts(today);
    const month = `${monthParts.find((p) => p.type === "year")!.value}-${monthParts.find((p) => p.type === "month")!.value}`;
    const from = boundary(String(req.query.from ?? month + "-01"));
    const businessToday = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(today);
    const defaultTo = new Date(
      Date.parse(businessToday + "T00:00:00Z") + 86400000,
    )
      .toISOString()
      .slice(0, 10);
    const to = boundary(String(req.query.to ?? defaultTo));
    if (Date.parse(from) >= Date.parse(to))
      throw new DomainError(400, "The period must end after it starts.");
    if (Date.parse(to) - Date.parse(from) > 366 * 86400000)
      throw new DomainError(400, "Choose a period of one year or less.");
    const [jobs, invoices, crews, bookings, callbacks, labor] =
      await Promise.all([
        db.select().from(jobsTable),
        db.select().from(invoicesTable),
        db.select().from(crewsTable),
        db.select().from(crewBookingsTable),
        db.select().from(jobCallbacksTable),
        db.select().from(laborEntriesTable),
      ]);
    const sold = jobs.filter((j) =>
      withinPeriod(eventDate(j, "sold"), from, to),
    );
    const completed = jobs.filter(
      (j) =>
        ["Completed", "Invoiced"].includes(j.status) &&
        withinPeriod(eventDate(j, "completed"), from, to),
    );
    const recordedBoundary = (value: string | null) => {
      try {
        return value ? boundary(value) : null;
      } catch {
        return null;
      }
    };
    const billed = invoices.filter(
      (i) =>
        !["Draft", "Voided"].includes(i.status) &&
        withinPeriod(recordedBoundary(i.issueDate), from, to),
    );
    const selectedBookings = bookings.filter(
      (b) =>
        b.status === "Confirmed" &&
        Date.parse(b.endAt) > Date.parse(from) &&
        Date.parse(b.startAt) < Date.parse(to),
    );
    let capacity = 0;
    const capacityKnown =
      crews.some((c) => c.active) &&
      crews
        .filter((c) => c.active)
        .every((c) => c.size && c.dailyCapacityHours && c.workingDays.length);
    for (const crew of crews.filter(
      (c) => c.active && c.size && c.dailyCapacityHours,
    )) {
      const dates = new Set<string>();
      for (
        let cursor = Date.parse(from) + 12 * 3600000;
        cursor < Date.parse(to);
        cursor += 86400000
      ) {
        const date = new Intl.DateTimeFormat("en-CA", {
          timeZone: crew.timezone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date(cursor));
        if (dates.has(date)) continue;
        dates.add(date);
        const day = new Intl.DateTimeFormat("en-US", {
          timeZone: crew.timezone,
          weekday: "short",
        }).format(new Date(cursor));
        if (
          crew.workingDays.includes(
            ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(day),
          ) &&
          !crew.unavailableDates.includes(date)
        )
          capacity += crew.size! * crew.dailyCapacityHours!;
      }
    }
    const plannedHours = selectedBookings.reduce(
      (sum, b) => sum + b.plannedLaborHours,
      0,
    );
    const periodLabor = labor.filter((l) =>
      withinPeriod(recordedBoundary(l.date), from, to),
    );
    const actualHours = periodLabor
      .filter((l) => l.crewId)
      .reduce((sum, l) => sum + l.hours, 0);
    res.json({
      from,
      to,
      timezone: "America/New_York",
      soldRevenue: sold.reduce((sum, j) => sum + j.estRevenue, 0),
      jobsSold: sold.length,
      completedRevenue: completed.reduce((sum, j) => sum + j.estRevenue, 0),
      invoicedRevenue: billed.reduce((sum, i) => sum + i.total, 0),
      outstanding: invoices
        .filter((i) => ["Sent", "Partial", "Overdue"].includes(i.status))
        .reduce((sum, i) => sum + Math.max(0, i.balanceAmount), 0),
      capacityHours: capacityKnown ? capacity : null,
      plannedLaborHours: plannedHours,
      actualLaborHours: actualHours,
      scheduledUtilization:
        capacityKnown && capacity > 0 ? (plannedHours / capacity) * 100 : null,
      actualUtilization:
        capacityKnown &&
        capacity > 0 &&
        periodLabor.length > 0 &&
        periodLabor.every((l) => l.crewId)
          ? (actualHours / capacity) * 100
          : null,
      callbacksOpened: callbacks.filter((c) =>
        withinPeriod(c.createdAt, from, to),
      ).length,
      callbacksOpen: callbacks.filter((c) => c.status === "Open").length,
      missingSoldDates: jobs.filter(
        (j) =>
          [
            "Approved",
            "Material Ordered",
            "Material Received",
            "Scheduled",
            "In Progress",
            "Final Walkthrough",
            "Completed",
            "Invoiced",
          ].includes(j.status) && !eventDate(j, "sold"),
      ).length,
      missingCompletionDates: jobs.filter(
        (j) =>
          ["Completed", "Invoiced"].includes(j.status) &&
          !eventDate(j, "completed"),
      ).length,
      unassignedLaborEntries: periodLabor.filter((l) => !l.crewId).length,
      sourceJobIds: sold.map((j) => j.id),
      definition:
        "Sales use recorded approval dates; completed revenue uses recorded completion dates. Utilization uses person-hours. Missing historical dates and crew capacity are excluded, never inferred from record edits.",
    });
  }),
);
export default router;
