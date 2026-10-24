import { useEffect, useMemo, useRef, useState } from "react";
import { useUnsavedForm } from "@/hooks/use-unsaved-changes";
import { useUrlState, useQueryControls } from "@/hooks/use-url-state";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/auth";
import { useStore, useTasks, useGoogleCalendar } from "@/hooks/use-store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  CalendarCheck,
  Plus,
  RefreshCw,
  Check,
  Trash2,
  CircleDot,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { Task, Salesperson } from "@/lib/types";

type ViewMode = "month" | "week" | "day" | "agenda";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_START_HOUR = 7;
const DAY_END_HOUR = 20;
const HOUR_PX = 48;
const UNASSIGNED_COLOR = "#94a3b8";

// A calendar entry is either a real internal task or a read-only follow-up
// pulled from a lead. Lead follow-ups are shown for visibility but cannot be
// dragged or edited here — they are managed on the lead.
interface CalEntry {
  id: string;
  source: "task" | "lead";
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  done: boolean;
  color: string;
  assigneeId: string | null;
  assigneeName: string | null;
  leadId?: string;
  task?: Task;
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function startOfWeek(d: Date) {
  const r = new Date(d);
  r.setDate(d.getDate() - d.getDay());
  r.setHours(0, 0, 0, 0);
  return r;
}

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(d.getDate() + n);
  return r;
}

function startOfDay(d: Date) {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function parseLocalDate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return new Date(NaN);
  return new Date(y, m - 1, d);
}

// Format a Date for an <input type="datetime-local"> value (local time).
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toDateInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

interface FormState {
  title: string;
  description: string;
  assigneeId: string;
  allDay: boolean;
  start: string;
  end: string;
}

const emptyForm = (start: Date, end: Date): FormState => ({
  title: "",
  description: "",
  assigneeId: "none",
  allDay: false,
  start: toLocalInput(start),
  end: toLocalInput(end),
});

export default function TaskCalendar() {
  const { salespeople, leads, jobs = [] } = useStore();
  const taskQuery = useTasks();
  const { tasks, addTask, updateTask, deleteTask } = taskQuery;
  const google = useGoogleCalendar();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const canManageBookings = user?.role === "owner" || user?.role === "operations";

  const [view, setView] = useUrlState<ViewMode>("view", "agenda");
  const [cursorValue, setCursorValue] = useUrlState<string>("date", toDateInput(new Date()));
  const cursor = useMemo(() => { const parsed = parseLocalDate(cursorValue); return Number.isNaN(parsed.getTime()) ? startOfDay(new Date()) : parsed; }, [cursorValue]);
  const setCursor = (value: Date) => setCursorValue(toDateInput(value));
  const [statusFilter, setStatusFilter] = useUrlState<string>("status", "All");
  const [assigneeFilter, setAssigneeFilter] = useUrlState<string>("assignee", "All");
  const query = useQueryControls();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() =>
    emptyForm(new Date(), new Date()),
  );
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
  const unsaved = useUnsavedForm(isFormOpen, form);
  const dragState = useRef<{
    id: string;
    mode: "move" | "resize";
    startY: number;
    origStart: Date;
    origEnd: Date;
  } | null>(null);

  const repById = useMemo(() => {
    const m = new Map<string, Salesperson>();
    for (const s of salespeople) m.set(s.id, s);
    return m;
  }, [salespeople]);

  const repByName = useMemo(() => {
    const m = new Map<string, Salesperson>();
    for (const s of salespeople) m.set(s.name.toLowerCase().trim(), s);
    return m;
  }, [salespeople]);

  const colorFor = (assigneeId: string | null): string => {
    if (!assigneeId) return UNASSIGNED_COLOR;
    return repById.get(assigneeId)?.color ?? UNASSIGNED_COLOR;
  };

  // Build the unified entry list: real tasks + aggregated lead follow-ups.
  const entries = useMemo<CalEntry[]>(() => {
    const out: CalEntry[] = [];

    for (const t of tasks) {
      const start = new Date(t.startAt);
      const end = new Date(t.endAt);
      if (Number.isNaN(start.getTime())) continue;
      const rep = t.assigneeId ? repById.get(t.assigneeId) : null;
      out.push({
        id: t.id,
        source: "task",
        title: t.title,
        start,
        end: Number.isNaN(end.getTime()) ? start : end,
        allDay: t.allDay,
        done: t.status === "Done",
        color: colorFor(t.assigneeId ?? null),
        assigneeId: t.assigneeId ?? null,
        assigneeName: rep?.name ?? null,
        task: t,
      });
    }

    for (const lead of leads) {
      for (const lt of lead.tasks ?? []) {
        if (!lt.dueDate) continue;
        const start = parseLocalDate(lt.dueDate);
        if (Number.isNaN(start.getTime())) continue;
        const rep = lt.assignedTo
          ? repByName.get(lt.assignedTo.toLowerCase().trim())
          : null;
        out.push({
          id: `lead-${lead.id}-${lt.id}`,
          source: "lead",
          title: `${lt.title} — ${lead.customerName}`,
          start,
          end: start,
          allDay: true,
          done: lt.completed,
          color: rep?.color ?? UNASSIGNED_COLOR,
          assigneeId: rep?.id ?? null,
          assigneeName: rep?.name ?? lt.assignedTo ?? null,
          leadId: lead.id,
        });
      }
    }

    return out.filter((entry) => (statusFilter === "All" || (entry.task?.status ?? (entry.done ? "Done" : "Open")) === statusFilter) && (assigneeFilter === "All" || (entry.assigneeId ?? "none") === assigneeFilter));
  }, [tasks, leads, repById, repByName, statusFilter, assigneeFilter]);

  const entriesOnDay = (day: Date) =>
    entries
      .filter((e) => sameDay(e.start, day))
      .sort((a, b) => a.start.getTime() - b.start.getTime());

  const legend = useMemo(() => {
    const active = salespeople.filter((s) => s.active);
    return active.map((s) => ({
      name: s.name,
      color: s.color ?? UNASSIGNED_COLOR,
    }));
  }, [salespeople]);

  const shift = (dir: number) => {
    const d = new Date(cursor);
    if (view === "month") d.setMonth(d.getMonth() + dir);
    else if (view === "week" || view === "agenda") d.setDate(d.getDate() + dir * 7);
    else d.setDate(d.getDate() + dir);
    setCursor(d);
  };

  const goToday = () => setCursor(startOfDay(new Date()));

  const title = useMemo(() => {
    if (view === "month")
      return cursor.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
    if (view === "week" || view === "agenda") {
      const start = view === "agenda" ? cursor : startOfWeek(cursor);
      const end = addDays(start, 6);
      return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
    }
    return cursor.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }, [cursor, view]);

  const today = startOfDay(new Date());

  // ---- Create / edit ----
  const openCreate = (start?: Date) => {
    setSaveError("");
    const s = start ?? new Date();
    if (!start) s.setMinutes(0, 0, 0);
    const e = new Date(s);
    e.setHours(e.getHours() + 1);
    setEditingId(null);
    setForm(emptyForm(s, e));
    unsaved.reset(emptyForm(s, e));
    setIsFormOpen(true);
  };

  const openEdit = (task: Task) => {
    if (task.bookingId) { navigate(canManageBookings ? `/calendar?booking=${encodeURIComponent(task.bookingId)}` : `/jobs/${task.relatedJobId ?? ""}`); return; }
    setSaveError("");
    setEditingId(task.id);
    const start = new Date(task.startAt);
    const end = new Date(task.endAt);
    const initial = {
      title: task.title,
      description: task.description,
      assigneeId: task.assigneeId ?? "none",
      allDay: task.allDay,
      start: task.allDay ? toDateInput(start) : toLocalInput(start),
      end: task.allDay ? toDateInput(end) : toLocalInput(end),
    };
    setForm(initial);
    unsaved.reset(initial);
    setIsFormOpen(true);
  };

  const createRequested = query.params.get("create") === "1";
  const relatedJob = jobs.find(job => job.id === query.params.get("jobId"));
  const relatedLead = leads.find(lead => lead.id === query.params.get("leadId"));
  const relatedLabel = relatedJob ? `${relatedJob.jobNumber} · ${relatedJob.customerName}` : relatedLead ? `Lead · ${relatedLead.customerName}` : "";
  useEffect(() => { if (createRequested) openCreate(); }, [createRequested]);
  const closeForm = (open: boolean) => { if (saving || (!open && !unsaved.confirmDiscard())) return; setIsFormOpen(open); if (!open) query.update({ create: null }); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!form.title.trim()) { setSaveError("Enter a task title."); return; }

    const startDate = form.allDay
      ? parseLocalDate(form.start)
      : new Date(form.start);
    const endDate = form.allDay ? parseLocalDate(form.end) : new Date(form.end);
    if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime())) { setSaveError("Enter a valid start and end date."); return; }
    if (endDate < startDate || (!form.allDay && endDate <= startDate)) { setSaveError("End time must be after the start time."); return; }

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      assigneeId: form.assigneeId === "none" ? null : form.assigneeId,
      allDay: form.allDay,
      startAt: startDate.toISOString(),
      endAt: endDate.toISOString(),
      status: editingId ? tasks.find((task) => task.id === editingId)?.status ?? "Open" : "Open" as const,
      ...(!editingId ? { relatedLeadId: query.params.get("leadId") ?? query.params.get("relatedLeadId"), relatedJobId: query.params.get("jobId") ?? query.params.get("relatedJobId") } : {}),
    };

    try {
      setSaving(true); setSaveError("");
      if (editingId) {
        await updateTask(editingId, payload);
      } else {
        await addTask(payload);
      }
      setIsFormOpen(false);
      setEditingId(null);
      query.update({ create: null });
      toast({ title: editingId ? "Task updated" : "Task created" });
    } catch (error) { setSaveError(error instanceof Error ? error.message : "Could not save this task. Your changes are still here."); }
    finally { setSaving(false); }
  };

  const toggleComplete = async (task: Task) => {
    if (task.bookingId) { openEdit(task); return; }
    try { await updateTask(task.id, {
      status: task.status === "Done" ? "Open" : "Done",
    }); toast({ title: task.status === "Done" ? "Task reopened" : "Task completed" }); }
    catch (error) { toast({ title: "Task was not updated", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" }); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.bookingId) { openEdit(deleteTarget); return; }
    try { await deleteTask(deleteTarget.id); setDeleteTarget(null); setIsFormOpen(false); toast({ title: "Task deleted" }); }
    catch (error) { toast({ title: "Task was not deleted", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" }); }
  };

  const runSync = async () => {
    try {
      const result = await google.sync();
      toast({
        title: "Google Calendar synced",
        description: `${result.pushed} pushed · ${result.created} added · ${result.updated} updated · ${result.deleted} removed.`,
      });
    } catch {
      toast({
        title: "Sync failed",
        description:
          "Could not sync with Google Calendar. Check the connection and try again.",
        variant: "destructive",
      });
    }
  };

  // ---- Drag / resize in week & day timed views ----
  const onPointerDownEntry = (
    e: React.PointerEvent,
    entry: CalEntry,
    mode: "move" | "resize",
  ) => {
    if (entry.source !== "task" || entry.allDay || entry.task?.bookingId) return;
    e.preventDefault();
    e.stopPropagation();
    dragState.current = {
      id: entry.id,
      mode,
      startY: e.clientY,
      origStart: entry.start,
      origEnd: entry.end,
    };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragState.current;
    if (!drag) return;
    const deltaPx = e.clientY - drag.startY;
    const deltaMin = Math.round(deltaPx / (HOUR_PX / 60) / 15) * 15;
    const el = document.getElementById(`task-block-${drag.id}`);
    if (!el) return;
    if (drag.mode === "move") {
      const newTop =
        minutesFromDayStart(drag.origStart) + deltaMin;
      el.style.top = `${(newTop / 60) * HOUR_PX}px`;
    } else {
      const durMin =
        (drag.origEnd.getTime() - drag.origStart.getTime()) / 60000 + deltaMin;
      el.style.height = `${Math.max(15, (durMin / 60) * HOUR_PX)}px`;
    }
  };

  const onPointerUp = async (e: React.PointerEvent) => {
    const drag = dragState.current;
    dragState.current = null;
    if (!drag) return;
    const deltaPx = e.clientY - drag.startY;
    const deltaMin = Math.round(deltaPx / (HOUR_PX / 60) / 15) * 15;
    if (deltaMin === 0) return;

    const task = tasks.find((t) => t.id === drag.id);
    if (!task || task.bookingId) return;

    let newStart = new Date(drag.origStart);
    let newEnd = new Date(drag.origEnd);
    if (drag.mode === "move") {
      newStart = new Date(drag.origStart.getTime() + deltaMin * 60000);
      newEnd = new Date(drag.origEnd.getTime() + deltaMin * 60000);
    } else {
      newEnd = new Date(drag.origEnd.getTime() + deltaMin * 60000);
      if (newEnd <= newStart)
        newEnd = new Date(newStart.getTime() + 15 * 60000);
    }
    try { await updateTask(task.id, {
      startAt: newStart.toISOString(),
      endAt: newEnd.toISOString(),
    }); toast({ title: "Task rescheduled" }); }
    catch (error) { const element = document.getElementById(`task-block-${task.id}`); if (element) { element.style.top = `${minutesFromDayStart(drag.origStart) / 60 * HOUR_PX}px`; element.style.height = `${Math.max(15, (drag.origEnd.getTime() - drag.origStart.getTime()) / 3600000 * HOUR_PX)}px`; } toast({ title: "Task was not rescheduled", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" }); }
  };

  function minutesFromDayStart(d: Date): number {
    return (d.getHours() - DAY_START_HOUR) * 60 + d.getMinutes();
  }

  // ---- Renderers ----
  const EntryChip = ({ entry }: { entry: CalEntry }) => (
    <button
      onClick={() => entry.task ? openEdit(entry.task) : entry.leadId && navigate(`/leads/${entry.leadId}`)}
      className={cn(
        "w-full text-left rounded px-1.5 py-0.5 text-[11px] leading-tight transition-opacity",
        entry.source === "task" ? "hover:opacity-80" : "cursor-default",
        entry.done && "opacity-50",
      )}
      style={{
        backgroundColor: `${entry.color}22`,
        borderLeft: `3px solid ${entry.color}`,
      }}
      title={entry.title}
    >
      <span
        className={cn(
          "block truncate font-medium",
          entry.done && "line-through",
        )}
      >
        {entry.source === "lead" && "🏷 "}
        {entry.title}
      </span>
    </button>
  );

  const renderMonth = () => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const gridStart = startOfWeek(first);
    const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
    return (
      <div className="grid grid-cols-7 border-l border-t rounded-lg overflow-hidden bg-card">
        {WEEKDAY_LABELS.map((d) => (
          <div
            key={d}
            className="border-r border-b bg-muted/50 px-2 py-1.5 text-xs font-medium text-muted-foreground text-center"
          >
            {d}
          </div>
        ))}
        {days.map((day) => {
          const dayEntries = entriesOnDay(day);
          const inMonth = day.getMonth() === cursor.getMonth();
          const isToday = sameDay(day, today);
          return (
            <div
              key={day.toISOString()}
              className={cn(
                "group border-r border-b min-h-[112px] p-1.5 space-y-1 align-top",
                !inMonth && "bg-muted/20 text-muted-foreground",
              )}
              onDoubleClick={() => {
                const s = new Date(day);
                s.setHours(9, 0, 0, 0);
                openCreate(s);
              }}
            >
              <div className="flex items-center justify-between">
                <div
                  className={cn(
                    "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full",
                    isToday && "bg-primary text-primary-foreground",
                  )}
                >
                  {day.getDate()}
                </div>
                <button
                  onClick={() => {
                    const s = new Date(day);
                    s.setHours(9, 0, 0, 0);
                    openCreate(s);
                  }}
                  aria-label={`Add task on ${toDateInput(day)}`}
                  className="flex h-7 w-7 items-center justify-center text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              {dayEntries.slice(0, 4).map((entry) => (
                <EntryChip key={entry.id} entry={entry} />
              ))}
              {dayEntries.length > 4 && (
                <div className="text-[11px] text-muted-foreground px-1">
                  +{dayEntries.length - 4} more
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderTimeGrid = (days: Date[]) => {
    const hours = Array.from(
      { length: DAY_END_HOUR - DAY_START_HOUR },
      (_, i) => DAY_START_HOUR + i,
    );
    return (
      <div className="rounded-lg border bg-card overflow-hidden">
        <div
          className="grid"
          style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}
        >
          <div className="border-b border-r bg-muted/30" />
          {days.map((day) => {
            const isToday = sameDay(day, today);
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "border-b border-r px-2 py-1.5 text-center",
                  isToday && "bg-primary/10",
                )}
              >
                <div className="text-xs font-medium text-muted-foreground">
                  {WEEKDAY_LABELS[day.getDay()]}
                </div>
                <div
                  className={cn(
                    "text-lg font-bold",
                    isToday && "text-primary",
                  )}
                >
                  {day.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* All-day row */}
        <div
          className="grid border-b"
          style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}
        >
          <div className="border-r px-1 py-1 text-[10px] text-muted-foreground text-right">
            all-day
          </div>
          {days.map((day) => {
            const allDayEntries = entriesOnDay(day).filter((e) => e.allDay);
            return (
              <div
                key={day.toISOString()}
                className="border-r p-1 space-y-1 min-h-[34px]"
              >
                {allDayEntries.map((entry) => (
                  <EntryChip key={entry.id} entry={entry} />
                ))}
              </div>
            );
          })}
        </div>

        {/* Timed grid */}
        <div
          className="grid relative"
          style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          <div className="border-r">
            {hours.map((h) => (
              <div
                key={h}
                className="text-[10px] text-muted-foreground text-right pr-1"
                style={{ height: HOUR_PX }}
              >
                {h % 12 === 0 ? 12 : h % 12}
                {h < 12 ? "am" : "pm"}
              </div>
            ))}
          </div>
          {days.map((day) => {
            const timed = entriesOnDay(day).filter((e) => !e.allDay);
            return (
              <div
                key={day.toISOString()}
                className="border-r relative"
                style={{ height: hours.length * HOUR_PX }}
                onDoubleClick={(ev) => {
                  const rect = (
                    ev.currentTarget as HTMLElement
                  ).getBoundingClientRect();
                  const offsetY = ev.clientY - rect.top;
                  const mins = Math.floor(offsetY / (HOUR_PX / 60) / 30) * 30;
                  const s = new Date(day);
                  s.setHours(DAY_START_HOUR, 0, 0, 0);
                  s.setMinutes(mins);
                  openCreate(s);
                }}
              >
                {hours.map((h) => (
                  <div
                    key={h}
                    className="border-b border-dashed border-muted"
                    style={{ height: HOUR_PX }}
                  />
                ))}
                {timed.map((entry) => {
                  const top =
                    (minutesFromDayStart(entry.start) / 60) * HOUR_PX;
                  const durMin = Math.max(
                    15,
                    (entry.end.getTime() - entry.start.getTime()) / 60000,
                  );
                  const height = (durMin / 60) * HOUR_PX;
                  return (
                    <div
                      key={entry.id}
                      id={`task-block-${entry.id}`}
                      role="button"
                      tabIndex={0}
                      aria-label={`${entry.title}, ${entry.start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`}
                      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); if (entry.task) openEdit(entry.task); } }}
                      className={cn(
                        "absolute left-0.5 right-0.5 rounded px-1.5 py-0.5 text-[11px] overflow-hidden select-none",
                        entry.source === "task"
                          ? "cursor-grab active:cursor-grabbing"
                          : "cursor-default",
                        entry.done && "opacity-50",
                      )}
                      style={{
                        top,
                        height,
                        backgroundColor: `${entry.color}26`,
                        borderLeft: `3px solid ${entry.color}`,
                      }}
                      onPointerDown={(ev) =>
                        onPointerDownEntry(ev, entry, "move")
                      }
                      onClick={() => entry.task && openEdit(entry.task)}
                    >
                      <div
                        className={cn(
                          "font-medium truncate",
                          entry.done && "line-through",
                        )}
                      >
                        {entry.source === "lead" && "🏷 "}
                        {entry.title}
                      </div>
                      {entry.assigneeName && (
                        <div className="text-[10px] text-muted-foreground truncate">
                          {entry.assigneeName}
                        </div>
                      )}
                      {entry.source === "task" && (
                        <div
                          className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize"
                          onPointerDown={(ev) =>
                            onPointerDownEntry(ev, entry, "resize")
                          }
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderWeek = () => renderTimeGrid(
    Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(cursor), i)),
  );

  const renderDay = () => renderTimeGrid([cursor]);

  const renderAgenda = () => {
    const first = view === "month" ? new Date(cursor.getFullYear(), cursor.getMonth(), 1) : view === "week" ? startOfWeek(cursor) : cursor;
    const last = view === "month" ? new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1) : addDays(first, view === "day" ? 1 : 7);
    const agenda = entries.filter((entry) => entry.start >= first && entry.start < last).sort((a, b) => a.start.getTime() - b.start.getTime());
    return <div className="overflow-hidden rounded-lg border bg-white">{agenda.length === 0 ? <div className="p-8 text-center"><CalendarCheck className="mx-auto mb-3 h-6 w-6 text-muted-foreground" /><p className="font-medium">No tasks match this view</p><p className="mt-1 text-sm text-muted-foreground">Change the date or filters, or add a task.</p><Button variant="outline" className="mt-4" onClick={() => openCreate(cursor)}>Add task</Button></div> : agenda.map((entry, index) => <div key={entry.id}>{(index === 0 || !sameDay(entry.start, agenda[index - 1].start)) && <h3 className="border-y bg-muted/40 px-4 py-2 text-xs font-semibold first:border-t-0">{entry.start.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</h3>}<button type="button" onClick={() => entry.task ? openEdit(entry.task) : entry.leadId && navigate(`/leads/${entry.leadId}`)} className="flex w-full gap-3 px-4 py-4 text-left hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"><span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ background: entry.color }} /><span className="min-w-0 flex-1"><span className={cn("block text-sm font-medium", entry.done && "line-through text-muted-foreground")}>{entry.title}</span><span className="mt-1 block text-xs text-muted-foreground">{entry.allDay ? "All day" : `${entry.start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}–${entry.end.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`} · {entry.assigneeName ?? (entry.assigneeId ? "Assigned" : "Unassigned")}</span><span className="mt-1 block text-xs text-muted-foreground">{entry.task?.bookingId ? "Installation booking · open schedule to edit" : entry.source === "lead" ? "Lead task · open lead to edit" : entry.task?.status ?? "Open"}</span></span></button></div>)}</div>;
  };

  const connected = google.status?.connected ?? false;
  const lastSynced = google.status?.lastSyncedAt;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Tasks &amp; follow-ups
          </h1>
          <p className="text-muted-foreground mt-1">
            Internal team tasks and lead follow-ups, color-coded by assignee.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border bg-background p-0.5">
            {(["agenda", "month", "week", "day"] as ViewMode[]).map((v) => (
              <button
                key={v}
                aria-pressed={view === v}
                onClick={() => setView(v)}
                className={cn(
                  "min-h-10 px-3 py-2 text-sm font-medium rounded capitalize transition-colors",
                  view === v
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {v}
              </button>
            ))}
          </div>
          <Button onClick={() => openCreate()}>
            <Plus className="w-4 h-4 mr-1" /> New Task
          </Button>
        </div>
      </div>

      {/* Google Calendar banner */}
      {google.allowed && <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm">
            {connected ? (
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            ) : (
              <CircleDot className="w-5 h-5 text-muted-foreground" />
            )}
            <div>
              <div className="font-medium">
                {google.error ? "Google Calendar status unavailable" : google.isLoading ? "Checking Google Calendar…" : connected
                  ? "Google Calendar connected"
                  : "Google Calendar not connected"}
              </div>
              <div className="text-xs text-muted-foreground">
                {connected
                  ? lastSynced
                    ? `Last synced ${new Date(lastSynced).toLocaleString()}`
                    : "Two-way sync ready — run a sync to push and pull events."
                  : google.status?.message ??
                    "Connect a Google account in the integrations panel to enable two-way sync."}
              </div>
            </div>
          </div>
          <Button
            variant={connected ? "default" : "outline"}
            onClick={runSync}
            disabled={!connected || google.isSyncing}
          >
            <RefreshCw
              className={cn("w-4 h-4 mr-1", google.isSyncing && "animate-spin")}
            />
            {google.isSyncing ? "Syncing…" : "Sync now"}
          </Button>
        </CardContent>
      </Card>}
      {user?.role === "operations" && <p className="text-xs text-muted-foreground">Google Calendar connection and syncing are managed by the workspace owner.</p>}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" aria-label="Previous period" onClick={() => shift(-1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" aria-label="Next period" onClick={() => shift(1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="outline" onClick={goToday}>
            Today
          </Button>
          <h2 className="text-lg font-semibold ml-2">{title}</h2>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3">
          {legend.map((l) => (
            <div key={l.name} className="flex items-center gap-1.5 text-xs">
              <span
                className="inline-block w-3 h-3 rounded-full"
                style={{ backgroundColor: l.color }}
              />
              {l.name}
            </div>
          ))}
          <div className="flex items-center gap-1.5 text-xs">
            <span
              className="inline-block w-3 h-3 rounded-full"
              style={{ backgroundColor: UNASSIGNED_COLOR }}
            />
            Unassigned
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 rounded-lg border bg-white p-4"><Input type="date" aria-label="Calendar date" value={toDateInput(cursor)} onChange={(event) => setCursorValue(event.target.value)} className="w-44" /><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger aria-label="Filter tasks by status" className="w-44"><SelectValue /></SelectTrigger><SelectContent>{["All", "Open", "Done", "Cancelled"].map((status) => <SelectItem key={status} value={status}>{status === "All" ? "All statuses" : status}</SelectItem>)}</SelectContent></Select><Select value={assigneeFilter} onValueChange={setAssigneeFilter}><SelectTrigger aria-label="Filter tasks by assignee" className="w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="All">All assignees</SelectItem><SelectItem value="none">Unassigned</SelectItem>{salespeople.map((person) => <SelectItem key={person.id} value={person.id}>{person.name}</SelectItem>)}</SelectContent></Select>{(statusFilter !== "All" || assigneeFilter !== "All") && <Button variant="ghost" onClick={() => query.update({ status: null, assignee: null })}>Clear filters</Button>}</div>
      {taskQuery.isLoading ? <p role="status" className="rounded-lg border bg-white p-6 text-sm">Loading tasks…</p> : taskQuery.error ? <div role="alert" className="rounded-lg border bg-white p-6"><p className="text-sm">Tasks could not load. Your records have not changed.</p><Button variant="outline" className="mt-3" onClick={() => void taskQuery.refetch()}>Retry</Button></div> : <><div className={view === "agenda" ? "" : "md:hidden"}>{renderAgenda()}</div>{view !== "agenda" && <div className="hidden md:block">{view === "month" && renderMonth()}{view === "week" && renderWeek()}{view === "day" && renderDay()}</div>}</>}

      <p className="text-xs text-muted-foreground">
        Open a task to edit its dates. In desktop week/day views, drag a task to reschedule or resize it. Lead tasks open the lead; installation bookings open their schedule record.
      </p>

      {/* Create / edit dialog */}
      <Dialog open={isFormOpen} onOpenChange={closeForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Task" : "New Task"}</DialogTitle>
            <DialogDescription>Set the owner and time for this task or appointment. Dates use your device timezone.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!editingId && relatedLabel && <p className="text-sm text-muted-foreground">Linked to {relatedLabel}.</p>}
            <div className="space-y-2">
              <Label htmlFor="task-field-1">Title</Label>
              <Input id="task-field-1"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Call back the Thompson lead"
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-field-2">Description</Label>
              <Textarea id="task-field-2"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Optional details"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Assignee</Label>
              <Select
                value={form.assigneeId}
                onValueChange={(v) => setForm({ ...form, assigneeId: v })}
              >
                <SelectTrigger aria-label="Assignee">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {salespeople
                    .filter((s) => s.active)
                    .map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        <span className="flex items-center gap-2">
                          <span
                            className="inline-block w-3 h-3 rounded-full"
                            style={{
                              backgroundColor: s.color ?? UNASSIGNED_COLOR,
                            }}
                          />
                          {s.name}
                        </span>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <Label htmlFor="task-all-day">All-day</Label>
              <Switch
                id="task-all-day"
                checked={form.allDay}
                onCheckedChange={(v) => {
                  if (v) {
                    setForm({
                      ...form,
                      allDay: true,
                      start: form.start.slice(0, 10),
                      end: form.end.slice(0, 10),
                    });
                  } else {
                    setForm({
                      ...form,
                      allDay: false,
                      start: `${form.start.slice(0, 10)}T09:00`,
                      end: `${form.end.slice(0, 10)}T10:00`,
                    });
                  }
                }}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="task-field-3">Start</Label>
                <Input id="task-field-3"
                  type={form.allDay ? "date" : "datetime-local"}
                  value={form.start}
                  onChange={(e) =>
                    setForm({ ...form, start: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="task-field-4">End</Label>
                <Input id="task-field-4"
                  type={form.allDay ? "date" : "datetime-local"}
                  value={form.end}
                  onChange={(e) => setForm({ ...form, end: e.target.value })}
                  required
                />
              </div>
            </div>
            {saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}
            <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
              <div className="flex gap-2">
                {editingId && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={saving}
                      onClick={() => {
                        const t = tasks.find((x) => x.id === editingId);
                        if (t) toggleComplete(t);
                        setIsFormOpen(false);
                      }}
                    >
                      <Check className="w-4 h-4 mr-1" />
                      {tasks.find((x) => x.id === editingId)?.status === "Done"
                        ? "Reopen"
                        : "Complete"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      aria-label="Delete task"
                      disabled={saving}
                      onClick={() => {
                        const t = tasks.find((x) => x.id === editingId);
                        if (t) setDeleteTarget(t);
                        setIsFormOpen(false);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </div>
              <div className="flex gap-2"><Button type="button" variant="outline" disabled={saving} onClick={() => closeForm(false)}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? "Saving…" : editingId ? "Save Changes" : "Add Task"}</Button></div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.title}" will be removed
              {deleteTarget?.googleEventId
                ? " and deleted from Google Calendar on the next sync"
                : ""}
              . This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
