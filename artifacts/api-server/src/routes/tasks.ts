import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, tasksTable, type TaskInsert, type TaskRow } from "@workspace/db";
import {
  ListTasksResponse,
  CreateTaskBody,
  UpdateTaskParams,
  UpdateTaskBody,
  UpdateTaskResponse,
  DeleteTaskParams,
} from "@workspace/api-zod";
import { stripNulls } from "../lib/strip-nulls";
import {
  gcalInsertEvent,
  gcalPatchEvent,
  gcalDeleteEvent,
  type TaskLike,
} from "../lib/google-calendar";

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

// Best-effort Google Calendar push. Never let a sync failure break local CRUD;
// the manual sync endpoint reconciles anything that did not push here.
async function pushCreate(task: TaskRow): Promise<void> {
  try {
    const eventId = await gcalInsertEvent(toTaskLike(task));
    await db
      .update(tasksTable)
      .set({ googleEventId: eventId })
      .where(eq(tasksTable.id, task.id));
  } catch {
    // Google not connected or transient error — ignore, sync will catch up.
  }
}

async function pushUpdate(task: TaskRow): Promise<void> {
  if (!task.googleEventId) {
    await pushCreate(task);
    return;
  }
  try {
    await gcalPatchEvent(task.googleEventId, toTaskLike(task));
  } catch {
    // ignore
  }
}

async function pushDelete(googleEventId: string | null): Promise<void> {
  if (!googleEventId) return;
  try {
    await gcalDeleteEvent(googleEventId);
  } catch {
    // ignore
  }
}

router.get("/tasks", async (_req, res): Promise<void> => {
  const tasks = await db.select().from(tasksTable);
  res.json(ListTasksResponse.parse(tasks.map(stripNulls)));
});

router.post("/tasks", async (req, res): Promise<void> => {
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid task body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const now = new Date().toISOString();
  const values: TaskInsert = {
    id: randomUUID(),
    title: parsed.data.title,
    description: parsed.data.description ?? "",
    assigneeId: parsed.data.assigneeId ?? null,
    startAt: parsed.data.startAt,
    endAt: parsed.data.endAt,
    allDay: parsed.data.allDay ?? false,
    status: parsed.data.status ?? "Open",
    relatedLeadId: parsed.data.relatedLeadId ?? null,
    relatedJobId: parsed.data.relatedJobId ?? null,
    createdAt: now,
    updatedAt: now,
  };

  const [task] = await db.insert(tasksTable).values(values).returning();
  await pushCreate(task);

  const [fresh] = await db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.id, task.id));
  res.status(201).json(UpdateTaskResponse.parse(stripNulls(fresh ?? task)));
});

router.patch("/tasks/:id", async (req, res): Promise<void> => {
  const params = UpdateTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [task] = await db
    .update(tasksTable)
    .set({ ...parsed.data, updatedAt: new Date().toISOString() })
    .where(eq(tasksTable.id, params.data.id))
    .returning();

  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  await pushUpdate(task);
  const [fresh] = await db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.id, task.id));
  res.json(UpdateTaskResponse.parse(stripNulls(fresh ?? task)));
});

router.delete("/tasks/:id", async (req, res): Promise<void> => {
  const params = DeleteTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(tasksTable)
    .where(eq(tasksTable.id, params.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  await pushDelete(deleted.googleEventId);
  res.status(204).end();
});

export default router;
