import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, tasksTable, settingsTable, crewBookingsTable, type TaskRow } from "@workspace/db";
import {
  GetGoogleCalendarStatusResponse,
  SyncGoogleCalendarResponse,
} from "@workspace/api-zod";
import {
  isGoogleCalendarConnected,
  gcalInsertEvent,
  gcalPatchEvent,
  gcalDeleteEvent,
  gcalListChanges,
  GoogleCalendarError,
  eventToTaskFields,
  getEventTaskId,
  type GEvent,
  type TaskLike,
} from "../lib/google-calendar";

const SETTINGS_ID = 1;

const router: IRouter = Router();

function toTaskLike(task: TaskRow): TaskLike {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    assigneeId: task.assigneeId,
    startAt: task.startAt,
    endAt: task.endAt,
    allDay: task.allDay,
  };
}

router.get("/calendar/google/status", async (_req, res): Promise<void> => {
  const connected = await isGoogleCalendarConnected();
  const [settings] = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.id, SETTINGS_ID));

  res.json(
    GetGoogleCalendarStatusResponse.parse({
      connected,
      calendarId: connected ? "primary" : null,
      lastSyncedAt: settings?.googleCalendarLastSyncedAt ?? null,
      message: connected
        ? null
        : "Connect a Google Calendar account in the integrations panel to enable two-way sync.",
    }),
  );
});

router.post("/calendar/google/sync", async (_req, res): Promise<void> => {
  if (!(await isGoogleCalendarConnected())) {
    res.status(503).json({
      error:
        "Google Calendar is not connected. Connect it in the integrations panel to enable sync.",
    });
    return;
  }

  let pushed = 0;
  let pulled = 0;
  let created = 0;
  let updated = 0;
  let deleted = 0;

  try {
    // --- PUSH: send local tasks that were never mirrored to Google. ---
    const localTasks = await db.select().from(tasksTable);
    for (const task of localTasks) {
      if (task.bookingId) {
        const [booking] = await db.select().from(crewBookingsTable).where(eq(crewBookingsTable.id, task.bookingId));
        if (booking?.calendarSyncStatus === "pending" && task.googleEventId) {
          try {
            if (task.status === "Cancelled") await gcalDeleteEvent(task.googleEventId);
            else await gcalPatchEvent(task.googleEventId, toTaskLike(task));
            await db.update(crewBookingsTable).set({ calendarSyncStatus: "synced", calendarSyncError: null }).where(eq(crewBookingsTable.id, task.bookingId)); pushed++;
          } catch { /* Retry on the next sync. */ }
        }
      }
      if (task.googleEventId || task.status === "Cancelled") continue;
      try {
        const eventId = await gcalInsertEvent(toTaskLike(task));
        await db
          .update(tasksTable)
          .set({ googleEventId: eventId })
          .where(eq(tasksTable.id, task.id));
        task.googleEventId = eventId;
        if (task.bookingId) await db.update(crewBookingsTable).set({ calendarSyncStatus: "synced", calendarSyncError: null }).where(eq(crewBookingsTable.id, task.bookingId));
        pushed++;
      } catch {
        // Skip this one; it will retry on the next sync.
      }
    }

    // --- PULL: read changes from Google and reconcile into tasks. ---
    const [settings] = await db
      .select()
      .from(settingsTable)
      .where(eq(settingsTable.id, SETTINGS_ID));

    let syncToken = settings?.googleCalendarSyncToken ?? null;
    let changes: { events: GEvent[]; nextSyncToken: string | null };
    try {
      changes = await gcalListChanges(syncToken);
    } catch (err) {
      if (err instanceof GoogleCalendarError && err.syncTokenExpired) {
        // Token expired — clear it and perform a full resync.
        syncToken = null;
        changes = await gcalListChanges(null);
      } else {
        throw err;
      }
    }

    // Index current tasks by their Google event id for fast reconciliation.
    const refreshed = await db.select().from(tasksTable);
    const byEventId = new Map<string, TaskRow>();
    for (const t of refreshed) {
      if (t.googleEventId) byEventId.set(t.googleEventId, t);
    }

    for (const event of changes.events) {
      pulled++;
      const existing = byEventId.get(event.id);

      if (existing?.bookingId) {
        const fields = event.status === "cancelled" ? null : eventToTaskFields(event);
        if ((event.status === "cancelled" && existing.status !== "Cancelled") || (fields && (Date.parse(fields.startAt) !== Date.parse(existing.startAt) || Date.parse(fields.endAt) !== Date.parse(existing.endAt)))) {
          await db.update(crewBookingsTable).set({ calendarSyncStatus: "conflict", calendarSyncError: fields ? `External calendar requested ${fields.startAt} to ${fields.endAt}. Review and resave the booking in Crew Schedule.` : "External calendar requested cancellation. Review and cancel the booking in Crew Schedule." }).where(eq(crewBookingsTable.id, existing.bookingId));
        }
        continue;
      }
      if (event.status === "cancelled") {
        if (existing) {
          await db.delete(tasksTable).where(eq(tasksTable.id, existing.id));
          byEventId.delete(event.id);
          deleted++;
        }
        continue;
      }

      const fields = eventToTaskFields(event);

      if (existing) {
        await db
          .update(tasksTable)
          .set({
            title: fields.title,
            description: fields.description,
            startAt: fields.startAt,
            endAt: fields.endAt,
            allDay: fields.allDay,
            // Preserve the local assignee unless Google carried our marker.
            assigneeId: fields.assigneeId ?? existing.assigneeId,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(tasksTable.id, existing.id));
        updated++;
      } else {
        // Avoid re-creating a task that already exists under our marker but had
        // its event id changed (rare); fall back to creating a fresh task.
        const knoxId = getEventTaskId(event);
        if (knoxId) {
          const [owned] = await db
            .select()
            .from(tasksTable)
            .where(eq(tasksTable.id, knoxId));
          if (owned) {
            await db
              .update(tasksTable)
              .set({ googleEventId: event.id })
              .where(eq(tasksTable.id, owned.id));
            byEventId.set(event.id, { ...owned, googleEventId: event.id });
            updated++;
            continue;
          }
        }

        const now = new Date().toISOString();
        const [inserted] = await db
          .insert(tasksTable)
          .values({
            id: randomUUID(),
            title: fields.title,
            description: fields.description,
            assigneeId: fields.assigneeId,
            startAt: fields.startAt,
            endAt: fields.endAt,
            allDay: fields.allDay,
            status: "Open",
            googleEventId: event.id,
            createdAt: now,
            updatedAt: now,
          })
          .returning();
        if (inserted) byEventId.set(event.id, inserted);
        created++;
      }
    }

    const lastSyncedAt = new Date().toISOString();
    await db
      .update(settingsTable)
      .set({
        googleCalendarSyncToken: changes.nextSyncToken ?? syncToken,
        googleCalendarLastSyncedAt: lastSyncedAt,
      })
      .where(eq(settingsTable.id, SETTINGS_ID));

    res.json(
      SyncGoogleCalendarResponse.parse({
        connected: true,
        pulled,
        created,
        updated,
        deleted,
        pushed,
        lastSyncedAt,
        message: null,
      }),
    );
  } catch (err) {
    const status = err instanceof GoogleCalendarError ? err.status : 502;
    const message =
      err instanceof Error ? err.message : "Google Calendar sync failed.";
    res.status(status).json({ error: message });
  }
});

export default router;
