import { Router } from "express";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  crewsTable,
  crewBookingsTable,
  jobsTable,
  tasksTable,
  jobCallbacksTable,
} from "@workspace/db";
import { requireRole } from "../middlewares/auth";
import { domainRoute, parse, revision, id } from "../lib/domain-http";
import {
  assertBooking,
  assertRevision,
  DomainError,
  overlaps,
} from "../lib/operations-rules";
import {
  gcalInsertEvent,
  gcalPatchEvent,
  gcalDeleteEvent,
} from "../lib/google-calendar";

const router = Router();
const crewInput = z.object({
  name: z.string().trim().min(1).max(100),
  active: z.boolean().default(true),
  timezone: z
    .string()
    .default("America/New_York")
    .refine((v) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: v });
        return true;
      } catch {
        return false;
      }
    }, "Choose a valid timezone"),
  size: z.number().int().positive().max(100).nullable().default(null),
  dailyCapacityHours: z
    .number()
    .finite()
    .positive()
    .max(24)
    .nullable()
    .default(null),
  workingDays: z.array(z.number().int().min(0).max(6)).default([]),
  unavailableDates: z
    .array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .default([]),
});
const bookingInput = z.object({
  crewId: z.string().min(1),
  jobId: z.string().min(1),
  startAt: z.string().datetime({ offset: true }),
  endAt: z.string().datetime({ offset: true }),
  plannedLaborHours: z.number().finite().positive(),
  notes: z.string().max(10000).default(""),
  status: z.enum(["Confirmed", "Cancelled"]).default("Confirmed"),
});
router.use("/crews", requireRole("owner", "operations"));
router.use("/bookings", requireRole("owner", "operations"));
router.use("/callbacks", requireRole("owner", "operations"));
router.get(
  "/crews",
  domainRoute(async (_req, res) => {
    res.json(await db.select().from(crewsTable));
  }),
);
router.post(
  "/crews",
  domainRoute(async (req, res) => {
    const data = parse(crewInput, req.body);
    const now = new Date().toISOString();
    const [row] = await db
      .insert(crewsTable)
      .values({ id: randomUUID(), ...data, createdAt: now, updatedAt: now })
      .returning();
    res.status(201).json(row);
  }),
);
router.patch(
  "/crews/:id",
  domainRoute(async (req, res) => {
    const { revision: expected, ...data } = parse(
      crewInput.partial().extend({ revision }),
      req.body,
    );
    const result = await db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${"crew:" + id(req)}))`,
      );
      const [current] = await tx
        .select()
        .from(crewsTable)
        .where(eq(crewsTable.id, id(req)))
        .for("update");
      if (!current) throw new DomainError(404, "Crew not found");
      assertRevision(current.revision, expected);
      const next = { ...current, ...data };
      const future = (
        await tx
          .select()
          .from(crewBookingsTable)
          .where(eq(crewBookingsTable.crewId, current.id))
      ).filter(
        (b) => b.status === "Confirmed" && Date.parse(b.endAt) > Date.now(),
      );
      if (future.length) {
        if (
          !next.active ||
          !next.size ||
          !next.dailyCapacityHours ||
          !next.workingDays.length
        )
          throw new DomainError(
            409,
            "Reassign or cancel future bookings before removing this crew’s capacity.",
          );
        const dateFormat = new Intl.DateTimeFormat("en-CA", {
          timeZone: next.timezone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        });
        const hoursByDay = new Map<string, number>();
        for (const booking of future) {
          const day = dateFormat.format(new Date(booking.startAt));
          const weekday = new Intl.DateTimeFormat("en-US", {
            timeZone: next.timezone,
            weekday: "short",
          }).format(new Date(booking.startAt));
          const duration =
            (Date.parse(booking.endAt) - Date.parse(booking.startAt)) / 3600000;
          if (
            day !==
              dateFormat.format(new Date(Date.parse(booking.endAt) - 1)) ||
            !next.workingDays.includes(
              ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
                weekday,
              ),
            ) ||
            next.unavailableDates.includes(day) ||
            booking.plannedLaborHours > duration * next.size + 0.000001
          )
            throw new DomainError(
              409,
              "This change conflicts with a confirmed booking. Reschedule it first.",
              { bookingId: booking.id },
            );
          hoursByDay.set(
            day,
            (hoursByDay.get(day) ?? 0) + booking.plannedLaborHours,
          );
        }
        if (
          [...hoursByDay.values()].some(
            (hours) => hours > next.size! * next.dailyCapacityHours! + 0.000001,
          )
        )
          throw new DomainError(
            409,
            "This capacity change would overbook a confirmed day. Reschedule work first.",
          );
      }
      const [row] = await tx
        .update(crewsTable)
        .set({
          ...data,
          revision: current.revision + 1,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(crewsTable.id, current.id))
        .returning();
      return row;
    });
    res.json(result);
  }),
);
router.get(
  "/bookings",
  domainRoute(async (req, res) => {
    const rows = await db.select().from(crewBookingsTable);
    res.json(
      rows.filter(
        (b) =>
          (!req.query.from || b.endAt > String(req.query.from)) &&
          (!req.query.to || b.startAt < String(req.query.to)) &&
          (!req.query.jobId || b.jobId === req.query.jobId),
      ),
    );
  }),
);
async function syncBookingTask(taskId: string | null) {
  if (!taskId) return;
  const [task] = await db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.id, taskId));
  if (!task) return;
  try {
    if (task.status === "Cancelled") {
      if (task.googleEventId) await gcalDeleteEvent(task.googleEventId);
      if (task.bookingId)
        await db
          .update(crewBookingsTable)
          .set({ calendarSyncStatus: "synced", calendarSyncError: null })
          .where(eq(crewBookingsTable.id, task.bookingId));
      return;
    }
    if (task.googleEventId) await gcalPatchEvent(task.googleEventId, task);
    else {
      const googleEventId = await gcalInsertEvent(task);
      await db
        .update(tasksTable)
        .set({ googleEventId })
        .where(eq(tasksTable.id, task.id));
    }
    if (task.bookingId)
      await db
        .update(crewBookingsTable)
        .set({ calendarSyncStatus: "synced", calendarSyncError: null })
        .where(eq(crewBookingsTable.id, task.bookingId));
  } catch (error) {
    if (task.bookingId)
      await db
        .update(crewBookingsTable)
        .set({
          calendarSyncStatus: "pending",
          calendarSyncError:
            error instanceof Error ? error.message : "Calendar sync pending",
        })
        .where(eq(crewBookingsTable.id, task.bookingId));
  }
}
const saveBooking = (create: boolean) =>
  domainRoute(async (req, res) => {
    const data = create
      ? parse(bookingInput.extend({ revision: revision.optional() }), req.body)
      : parse(bookingInput.partial().extend({ revision }), req.body);
    const result = await db.transaction(async (tx) => {
      const [before] = create
        ? []
        : await tx
            .select()
            .from(crewBookingsTable)
            .where(eq(crewBookingsTable.id, id(req)));
      if (!create && !before) throw new DomainError(404, "Booking not found");
      for (const crewId of [
        ...new Set([before?.crewId, data.crewId].filter(Boolean) as string[]),
      ].sort())
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtext(${"crew:" + crewId}))`,
        );
      const [current] = create
        ? []
        : await tx
            .select()
            .from(crewBookingsTable)
            .where(eq(crewBookingsTable.id, id(req)))
            .for("update");
      if (current) assertRevision(current.revision, data.revision);
      const input = parse(bookingInput, { ...current, ...data });
      const duration = assertBooking(input);
      const [crew] = await tx
        .select()
        .from(crewsTable)
        .where(eq(crewsTable.id, input.crewId));
      const [job] = await tx
        .select()
        .from(jobsTable)
        .where(eq(jobsTable.id, input.jobId));
      if (!crew || !job) throw new DomainError(404, "Crew or job not found");
      const dayFmt = new Intl.DateTimeFormat("en-CA", {
        timeZone: crew.timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      const startDay = dayFmt.format(new Date(input.startAt));
      const endDay = dayFmt.format(new Date(Date.parse(input.endAt) - 1));
      if (input.status === "Confirmed") {
        if (
          !crew.active ||
          !crew.size ||
          !crew.dailyCapacityHours ||
          !crew.workingDays.length
        )
          throw new DomainError(
            409,
            "Configure this crew’s size, working days and daily capacity before confirming a booking.",
          );
        if (startDay !== endDay)
          throw new DomainError(
            400,
            "Split a multi-day installation into one booking per working day.",
          );
        const weekday = new Intl.DateTimeFormat("en-US", {
          timeZone: crew.timezone,
          weekday: "short",
        }).format(new Date(input.startAt));
        if (
          !crew.workingDays.includes(
            ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday),
          ) ||
          crew.unavailableDates.includes(startDay)
        )
          throw new DomainError(
            409,
            "This crew is unavailable on the selected day.",
          );
        if (input.plannedLaborHours > duration * crew.size + 0.000001)
          throw new DomainError(
            400,
            "Planned person-hours exceed the booking duration and crew size.",
          );
        const bookings = (
          await tx
            .select()
            .from(crewBookingsTable)
            .where(eq(crewBookingsTable.crewId, crew.id))
        ).filter((b) => b.id !== current?.id && b.status === "Confirmed");
        const collision = bookings.find((b) => overlaps(input, b));
        if (collision)
          throw new DomainError(
            409,
            "This crew already has an overlapping booking.",
            { bookingId: collision.id },
          );
        const dailyHours = bookings
          .filter((b) => dayFmt.format(new Date(b.startAt)) === startDay)
          .reduce((sum, b) => sum + b.plannedLaborHours, 0);
        if (
          dailyHours + input.plannedLaborHours >
          crew.size * crew.dailyCapacityHours + 0.000001
        )
          throw new DomainError(
            409,
            "This booking exceeds the crew’s daily person-hour capacity.",
          );
      }
      const now = new Date().toISOString();
      const bookingId = current?.id ?? randomUUID();
      const taskId = current?.taskId ?? randomUUID();
      const task = {
        title: `${job.jobNumber} · ${job.customerName}`,
        description: `${crew.name}\n${input.notes}`,
        startAt: new Date(input.startAt).toISOString(),
        endAt: new Date(input.endAt).toISOString(),
        relatedJobId: job.id,
        bookingId,
        status: input.status === "Cancelled" ? "Cancelled" : "Open",
        allDay: false,
        updatedAt: now,
      };
      if (current?.taskId)
        await tx.update(tasksTable).set(task).where(eq(tasksTable.id, taskId));
      else
        await tx
          .insert(tasksTable)
          .values({ id: taskId, ...task, createdAt: now });
      if (current) {
        const [row] = await tx
          .update(crewBookingsTable)
          .set({
            ...input,
            startAt: task.startAt,
            endAt: task.endAt,
            taskId,
            calendarSyncStatus: "pending",
            calendarSyncError: null,
            revision: current.revision + 1,
            updatedAt: now,
          })
          .where(eq(crewBookingsTable.id, current.id))
          .returning();
        return row;
      }
      const [row] = await tx
        .insert(crewBookingsTable)
        .values({
          id: bookingId,
          ...input,
          startAt: task.startAt,
          endAt: task.endAt,
          taskId,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      return row;
    });
    await syncBookingTask(result.taskId);
    res.status(create ? 201 : 200).json(result);
  });
router.post("/bookings", saveBooking(true));
router.patch("/bookings/:id", saveBooking(false));
const callbackInput = z.object({
  jobId: z.string().min(1),
  reason: z.string().trim().min(1).max(2000),
  status: z.enum(["Open", "Resolved"]).default("Open"),
  assignedTo: z.string().max(200).default(""),
  notes: z.string().max(10000).default(""),
});
router.get(
  "/callbacks",
  domainRoute(async (_req, res) => {
    res.json(await db.select().from(jobCallbacksTable));
  }),
);
router.post(
  "/callbacks",
  domainRoute(async (req, res) => {
    const data = parse(callbackInput, req.body);
    if (
      !(
        await db.select().from(jobsTable).where(eq(jobsTable.id, data.jobId))
      )[0]
    )
      throw new DomainError(404, "Job not found");
    const now = new Date().toISOString();
    const [row] = await db
      .insert(jobCallbacksTable)
      .values({
        id: randomUUID(),
        ...data,
        resolvedAt: data.status === "Resolved" ? now : null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    res.status(201).json(row);
  }),
);
router.patch(
  "/callbacks/:id",
  domainRoute(async (req, res) => {
    const data = parse(callbackInput.omit({ jobId: true }).partial(), req.body);
    const [row] = await db
      .update(jobCallbacksTable)
      .set({
        ...data,
        ...(data.status
          ? {
              resolvedAt:
                data.status === "Resolved" ? new Date().toISOString() : null,
            }
          : {}),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(jobCallbacksTable.id, id(req)))
      .returning();
    if (!row) throw new DomainError(404, "Callback not found");
    res.json(row);
  }),
);
export default router;
