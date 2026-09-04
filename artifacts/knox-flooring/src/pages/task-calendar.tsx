import { useMemo, useRef, useState } from "react";
import { useStore, useTasks, useGoogleCalendar } from "@/hooks/use-store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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

type ViewMode = "month" | "week" | "day";

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
  const { salespeople, leads } = useStore();
  const { tasks, addTask, updateTask, deleteTask } = useTasks();
  const google = useGoogleCalendar();

  const [view, setView] = useState<ViewMode>("week");
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() =>
    emptyForm(new Date(), new Date()),
  );
  const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
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

    return out;
  }, [tasks, leads, repById, repByName]);

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
    else if (view === "week") d.setDate(d.getDate() + dir * 7);
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
    if (view === "week") {
      const start = startOfWeek(cursor);
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
    const s = start ?? new Date();
    if (!start) s.setMinutes(0, 0, 0);
    const e = new Date(s);
    e.setHours(e.getHours() + 1);
    setEditingId(null);
    setForm(emptyForm(s, e));
    setIsFormOpen(true);
  };

  const openEdit = (task: Task) => {
    setEditingId(task.id);
    const start = new Date(task.startAt);
    const end = new Date(task.endAt);
    setForm({
      title: task.title,
      description: task.description,
      assigneeId: task.assigneeId ?? "none",
      allDay: task.allDay,
      start: task.allDay ? toDateInput(start) : toLocalInput(start),
      end: task.allDay ? toDateInput(end) : toLocalInput(end),
    });
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;

    const startDate = form.allDay
      ? parseLocalDate(form.start)
      : new Date(form.start);
    let endDate = form.allDay ? parseLocalDate(form.end) : new Date(form.end);
    if (Number.isNaN(endDate.getTime()) || endDate < startDate) {
      endDate = new Date(startDate);
      if (!form.allDay) endDate.setHours(endDate.getHours() + 1);
    }

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      assigneeId: form.assigneeId === "none" ? null : form.assigneeId,
      allDay: form.allDay,
      startAt: startDate.toISOString(),
      endAt: endDate.toISOString(),
      status: "Open" as const,
    };

    try {
      if (editingId) {
        await updateTask(editingId, payload);
      } else {
        await addTask(payload);
      }
      setIsFormOpen(false);
      setEditingId(null);
    } catch {
      toast({
        title: "Could not save task",
        description: "Please try again.",
        variant: "destructive",
      });
    }
  };

  const toggleComplete = async (task: Task) => {
    await updateTask(task.id, {
      status: task.status === "Done" ? "Open" : "Done",
    });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await deleteTask(deleteTarget.id);
    setDeleteTarget(null);
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
    if (entry.source !== "task" || entry.allDay) return;
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
    if (!task) return;

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
    await updateTask(task.id, {
      startAt: newStart.toISOString(),
      endAt: newEnd.toISOString(),
    });
  };

  function minutesFromDayStart(d: Date): number {
    return (d.getHours() - DAY_START_HOUR) * 60 + d.getMinutes();
  }

  // ---- Renderers ----
  const EntryChip = ({ entry }: { entry: CalEntry }) => (
    <button
      onClick={() => entry.task && openEdit(entry.task)}
      disabled={entry.source !== "task"}
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
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
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

  const connected = google.status?.connected ?? false;
  const lastSynced = google.status?.lastSyncedAt;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <CalendarCheck className="w-7 h-7 text-primary" /> Task Calendar
          </h1>
          <p className="text-muted-foreground mt-1">
            Internal team tasks and lead follow-ups, color-coded by assignee.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border bg-background p-0.5">
            {(["month", "week", "day"] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium rounded capitalize transition-colors",
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
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm">
            {connected ? (
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            ) : (
              <CircleDot className="w-5 h-5 text-muted-foreground" />
            )}
            <div>
              <div className="font-medium">
                {connected
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
      </Card>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => shift(-1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => shift(1)}>
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

      {view === "month" && renderMonth()}
      {view === "week" && renderWeek()}
      {view === "day" && renderDay()}

      <p className="text-xs text-muted-foreground">
        Double-click an empty slot to add a task. Drag a task to reschedule, or
        drag its bottom edge to resize. 🏷 entries are lead follow-ups (managed
        on the lead).
      </p>

      {/* Create / edit dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Task" : "New Task"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Call back the Thompson lead"
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
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
                <SelectTrigger>
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
              <Label>All-day</Label>
              <Switch
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Start</Label>
                <Input
                  type={form.allDay ? "date" : "datetime-local"}
                  value={form.start}
                  onChange={(e) =>
                    setForm({ ...form, start: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>End</Label>
                <Input
                  type={form.allDay ? "date" : "datetime-local"}
                  value={form.end}
                  onChange={(e) => setForm({ ...form, end: e.target.value })}
                  required
                />
              </div>
            </div>
            <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
              <div className="flex gap-2">
                {editingId && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
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
              <Button type="submit">
                {editingId ? "Save Changes" : "Add Task"}
              </Button>
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
