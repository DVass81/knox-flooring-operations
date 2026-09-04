import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useStore } from "@/hooks/use-store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft,
  ChevronRight,
  MapPin,
  Users,
  CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Job } from "@/lib/types";

type ViewMode = "month" | "week" | "day";

const SCHEDULED_STATUSES = ["Scheduled", "In Progress", "Final Walkthrough"];
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// Parse a "YYYY-MM-DD" string as a local date. Using `new Date(str)` would
// interpret it as UTC midnight, shifting the day for non-UTC timezones.
function parseLocalDate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return new Date(NaN);
  return new Date(y, m - 1, d);
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

const STATUS_COLORS: Record<string, string> = {
  Scheduled: "border-l-blue-500 bg-blue-500/5",
  "In Progress": "border-l-amber-500 bg-amber-500/5",
  "Final Walkthrough": "border-l-green-500 bg-green-500/5",
};

export default function CalendarPage() {
  const { jobs } = useStore();
  const [, navigate] = useLocation();
  const [view, setView] = useState<ViewMode>("month");
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const scheduledJobs = useMemo(
    () =>
      jobs.filter(
        (j) => SCHEDULED_STATUSES.includes(j.status) && j.estStartDate,
      ),
    [jobs],
  );

  const jobsOnDay = (day: Date): Job[] =>
    scheduledJobs.filter((j) => {
      const d = parseLocalDate(j.estStartDate as string);
      return !Number.isNaN(d.getTime()) && sameDay(d, day);
    });

  const shift = (dir: number) => {
    const d = new Date(cursor);
    if (view === "month") d.setMonth(d.getMonth() + dir);
    else if (view === "week") d.setDate(d.getDate() + dir * 7);
    else d.setDate(d.getDate() + dir);
    setCursor(d);
  };

  const goToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    setCursor(d);
  };

  const title = useMemo(() => {
    if (view === "month") {
      return cursor.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
    }
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

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const JobChip = ({ job, compact }: { job: Job; compact?: boolean }) => (
    <button
      onClick={() => navigate(`/jobs/${job.id}`)}
      className={cn(
        "w-full text-left rounded border-l-4 px-2 py-1 transition-colors hover:bg-muted",
        STATUS_COLORS[job.status] ?? "border-l-primary bg-primary/5",
      )}
    >
      <div className="font-medium text-xs truncate">{job.customerName}</div>
      {!compact && (
        <div className="text-[11px] text-muted-foreground truncate">
          {job.flooringType}
        </div>
      )}
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-0.5">
          <Users className="w-3 h-3" />
          {job.crewAssigned.replace("Crew ", "")}
        </span>
        {!compact && (
          <span className="flex items-center gap-0.5 truncate">
            <MapPin className="w-3 h-3" />
            {job.city}
          </span>
        )}
      </div>
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
          const dayJobs = jobsOnDay(day);
          const inMonth = day.getMonth() === cursor.getMonth();
          const isToday = sameDay(day, today);
          return (
            <div
              key={day.toISOString()}
              className={cn(
                "border-r border-b min-h-[104px] p-1.5 space-y-1 align-top",
                !inMonth && "bg-muted/20 text-muted-foreground",
              )}
            >
              <div
                className={cn(
                  "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full",
                  isToday && "bg-primary text-primary-foreground",
                )}
              >
                {day.getDate()}
              </div>
              {dayJobs.slice(0, 3).map((job) => (
                <JobChip key={job.id} job={job} compact />
              ))}
              {dayJobs.length > 3 && (
                <div className="text-[11px] text-muted-foreground px-1">
                  +{dayJobs.length - 3} more
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderWeek = () => {
    const start = startOfWeek(cursor);
    const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    return (
      <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
        {days.map((day) => {
          const dayJobs = jobsOnDay(day);
          const isToday = sameDay(day, today);
          return (
            <div key={day.toISOString()} className="space-y-2">
              <div
                className={cn(
                  "text-center rounded-md py-1.5",
                  isToday ? "bg-primary text-primary-foreground" : "bg-muted/50",
                )}
              >
                <div className="text-xs font-medium">
                  {WEEKDAY_LABELS[day.getDay()]}
                </div>
                <div className="text-lg font-bold">{day.getDate()}</div>
              </div>
              <div className="space-y-1.5 min-h-[60px]">
                {dayJobs.length === 0 ? (
                  <div className="text-[11px] text-muted-foreground text-center py-3">
                    —
                  </div>
                ) : (
                  dayJobs.map((job) => <JobChip key={job.id} job={job} />)
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderDay = () => {
    const dayJobs = jobsOnDay(cursor);
    return (
      <Card>
        <CardContent className="p-4 space-y-2">
          {dayJobs.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              No installs scheduled for this day.
            </div>
          ) : (
            dayJobs.map((job) => (
              <button
                key={job.id}
                onClick={() => navigate(`/jobs/${job.id}`)}
                className={cn(
                  "w-full text-left rounded-md border-l-4 p-3 transition-colors hover:bg-muted",
                  STATUS_COLORS[job.status] ?? "border-l-primary bg-primary/5",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{job.customerName}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {job.status}
                  </Badge>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" /> {job.crewAssigned}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" /> {job.city}
                  </span>
                  <span>
                    {job.flooringType} ({job.squareFootage} sqft)
                  </span>
                </div>
              </button>
            ))
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <CalendarDays className="w-7 h-7 text-primary" /> Install Calendar
          </h1>
          <p className="text-muted-foreground mt-1">
            Scheduled installations. Click any job to open its details.
          </p>
        </div>
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
      </div>

      <div className="flex items-center justify-between">
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
        </div>
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>

      {view === "month" && renderMonth()}
      {view === "week" && renderWeek()}
      {view === "day" && renderDay()}
    </div>
  );
}
