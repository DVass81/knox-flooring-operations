import { useUnsavedForm } from "@/hooks/use-unsaved-changes";
import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { useStore } from "@/hooks/use-store";
import { useUrlState, useQueryControls } from "@/hooks/use-url-state";
import {
  useOperation,
  operation,
  useRefreshOperations,
  quantity,
  type Crew,
  type Booking,
} from "@/lib/operations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Users,
} from "lucide-react";

const selectStyle = "h-11 w-full rounded-lg border bg-background px-3 text-sm";
const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const localTime = (iso: string) => {
  const d = new Date(iso);
  return `${localDate(d)}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const dateInZone = (iso: string, zone: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
const blankCrew = () => ({
  name: "",
  active: true,
  timezone: "America/New_York",
  size: "",
  dailyCapacityHours: "",
  workingDays: [] as number[],
  unavailableDates: "",
});

export function InstallationSchedule({
  crewView = false,
}: {
  crewView?: boolean;
}) {
  const { jobs, queryState } = useStore();
  const crews = useOperation<Crew[]>("/crews", ["owner", "operations"]);
  const bookings = useOperation<Booking[]>("/bookings", [
    "owner",
    "operations",
  ]);
  const refresh = useRefreshOperations();
  const [date, setDate] = useUrlState<string>("date", localDate(new Date()));
  const [crewFilter, setCrewFilter] = useUrlState<string>("crew", "all");
  const [showCancelled, setShowCancelled] = useUrlState<string>(
    "cancelled",
    "no",
  );
  const { params, update: updateQuery } = useQueryControls();
  const bookingId = params.get("booking");
  const [crewOpen, setCrewOpen] = useState(false);
  const [editingCrew, setEditingCrew] = useState<Crew | null>(null);
  const [crewForm, setCrewForm] = useState(blankCrew);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [bookingForm, setBookingForm] = useState({
    jobId: "",
    crewId: "",
    startAt: "",
    endAt: "",
    plannedLaborHours: "",
    notes: "",
    status: "Confirmed",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const crewChanges = useUnsavedForm(crewOpen, crewForm);
  const bookingChanges = useUnsavedForm(bookingOpen, bookingForm);
  const openedBookingId = useRef<string | null>(null);
  const requestedDate = /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? new Date(`${date}T12:00:00`)
    : new Date();
  const cursor = Number.isFinite(requestedDate.getTime())
    ? requestedDate
    : new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(cursor);
    d.setDate(d.getDate() + i);
    return localDate(d);
  });
  const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const visibleBookings = (bookings.data ?? []).filter(
    (b) =>
      (showCancelled === "yes" || b.status === "Confirmed") &&
      (crewFilter === "all" || b.crewId === crewFilter),
  );
  const openCrew = (c?: Crew) => {
    if (busy || (crewOpen && !crewChanges.confirmDiscard())) return;
    const next = c
      ? {
          ...c,
          size: c.size == null ? "" : String(c.size),
          dailyCapacityHours:
            c.dailyCapacityHours == null ? "" : String(c.dailyCapacityHours),
          unavailableDates: c.unavailableDates.join(", "),
        }
      : blankCrew();
    crewChanges.reset(next);
    setEditingCrew(c ?? null);
    setCrewForm(next);
    setError("");
    setCrewOpen(true);
  };
  const openBooking = (b?: Booking) => {
    if (busy || (bookingOpen && !bookingChanges.confirmDiscard())) return;
    const next = b
      ? {
          ...b,
          startAt: localTime(b.startAt),
          endAt: localTime(b.endAt),
          plannedLaborHours: String(b.plannedLaborHours),
        }
      : {
          jobId: "",
          crewId: crewFilter === "all" ? "" : crewFilter,
          startAt: `${localDate(cursor)}T08:00`,
          endAt: `${localDate(cursor)}T09:00`,
          plannedLaborHours: "",
          notes: "",
          status: "Confirmed",
        };
    bookingChanges.reset(next);
    setEditingBooking(b ?? null);
    setBookingForm(next);
    setError("");
    setBookingOpen(true);
  };
  useEffect(() => {
    if (!bookingId) {
      openedBookingId.current = null;
      return;
    }
    const booking = bookings.data?.find((b) => b.id === bookingId);
    if (!booking || busy || openedBookingId.current === bookingId) return;
    if (bookingOpen && !bookingChanges.confirmDiscard()) {
      updateQuery({ booking: editingBooking?.id ?? null });
      return;
    }
    openedBookingId.current = bookingId;
    const next = {
      ...booking,
      startAt: localTime(booking.startAt),
      endAt: localTime(booking.endAt),
      plannedLaborHours: String(booking.plannedLaborHours),
    };
    bookingChanges.reset(next);
    setEditingBooking(booking);
    setBookingForm(next);
    setError("");
    setBookingOpen(true);
  }, [
    bookingId,
    bookings.data,
    busy,
    bookingOpen,
    editingBooking?.id,
    bookingChanges.confirmDiscard,
  ]);
  const save = async (kind: "crew" | "booking") => {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (kind === "crew") {
        if (!crewForm.name.trim()) throw new Error("Enter a crew name.");
        const unavailableDates = crewForm.unavailableDates
          .split(/[,\n]/)
          .map((v) => v.trim())
          .filter(Boolean);
        if (unavailableDates.some((v) => !/^\d{4}-\d{2}-\d{2}$/.test(v)))
          throw new Error(
            "Unavailable dates must use YYYY-MM-DD, separated by commas.",
          );
        await operation(
          `/crews${editingCrew ? `/${editingCrew.id}` : ""}`,
          editingCrew ? "PATCH" : "POST",
          {
            ...crewForm,
            size: crewForm.size === "" ? null : Number(crewForm.size),
            dailyCapacityHours:
              crewForm.dailyCapacityHours === ""
                ? null
                : Number(crewForm.dailyCapacityHours),
            unavailableDates,
            ...(editingCrew ? { revision: editingCrew.revision } : {}),
          },
        );
        crewChanges.reset(crewForm);
        setCrewOpen(false);
        setMessage("Crew saved.");
      } else {
        if (
          !bookingForm.jobId ||
          !bookingForm.crewId ||
          !bookingForm.startAt ||
          !bookingForm.endAt ||
          !bookingForm.plannedLaborHours
        )
          throw new Error(
            "Choose a job and crew, enter start and end times, and planned person-hours.",
          );
        await operation(
          `/bookings${editingBooking ? `/${editingBooking.id}` : ""}`,
          editingBooking ? "PATCH" : "POST",
          {
            ...bookingForm,
            startAt: new Date(bookingForm.startAt).toISOString(),
            endAt: new Date(bookingForm.endAt).toISOString(),
            plannedLaborHours: Number(bookingForm.plannedLaborHours),
            ...(editingBooking ? { revision: editingBooking.revision } : {}),
          },
        );
        bookingChanges.reset(bookingForm);
        setBookingOpen(false);
        updateQuery({ booking: null });
        setMessage("Installation booking saved.");
      }
      await refresh();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The changes could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  };
  const bookingCard = (b: Booking) => {
    const c = crews.data?.find((c) => c.id === b.crewId),
      j = jobs.find((j) => j.id === b.jobId);
    return (
      <article key={b.id} className="rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <Link
              href={`/jobs/${b.jobId}`}
              className="font-semibold hover:underline"
            >
              {j ? `${j.jobNumber} · ${j.customerName}` : "Open job"}
            </Link>
            <p className="mt-1 text-sm text-muted-foreground">
              {c?.name ?? "Crew unavailable"} · {j?.city}
            </p>
          </div>
          <Badge variant="outline">{b.status}</Badge>
        </div>
        <p className="mt-3 text-sm tabular-nums">
          {new Date(b.startAt).toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
            timeZone: c?.timezone,
          })}
          –
          {new Date(b.endAt).toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
            timeZone: c?.timezone,
          })}{" "}
          · {quantity(b.plannedLaborHours)} person-hours
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{c?.timezone}</p>
        {b.notes && (
          <p className="mt-2 whitespace-pre-wrap text-sm">{b.notes}</p>
        )}
        {b.calendarSyncStatus && b.calendarSyncStatus !== "synced" && (
          <p className="mt-2 text-xs text-amber-800">
            {b.calendarSyncStatus === "conflict"
              ? "Calendar conflict: review this booking before rescheduling."
              : "External calendar sync pending. This booking is saved here."}
          </p>
        )}
        <Button
          className="mt-3"
          size="sm"
          variant="outline"
          onClick={() => openBooking(b)}
        >
          Edit booking
        </Button>
      </article>
    );
  };
  const unconfirmed = jobs.filter(
    (j) =>
      j.estStartDate &&
      !["Completed", "Invoiced"].includes(j.status) &&
      !(bookings.data ?? []).some(
        (b) => b.jobId === j.id && b.status === "Confirmed",
      ),
  );
  if (!crews.allowed || !bookings.allowed)
    return (
      <div className="rounded-xl border p-6">
        <h1 className="text-xl font-semibold">Scheduling access</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Crew scheduling is available to owner and operations roles.
        </p>
      </div>
    );
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {crewView ? "Crews & capacity" : "Installations"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {crewView
              ? "Configure the people, working days, and hours available for installation."
              : "Confirmed bookings, with capacity checked for each crew and day."}
          </p>
        </div>
        <Button
          disabled={
            busy ||
            crews.isLoading ||
            bookings.isLoading ||
            crews.isError ||
            bookings.isError ||
            (!crewView &&
              (queryState.jobs.isLoading || !!queryState.jobs.error))
          }
          onClick={() => (crewView ? openCrew() : openBooking())}
        >
          <Plus className="mr-2 h-4 w-4" />
          {crewView ? "Add crew" : "Book installation"}
        </Button>
      </header>
      {(crews.isError || bookings.isError) && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-900"
        >
          Scheduling records could not load.{" "}
          <button onClick={() => refresh()} className="underline">
            Retry
          </button>
        </p>
      )}
      {queryState.jobs.error && (
        <p role="alert" className="text-sm text-destructive">
          Job details could not load.{" "}
          <button className="underline" onClick={() => refresh()}>
            Retry
          </button>
        </p>
      )}
      {message && (
        <p role="status" className="text-sm text-emerald-800">
          {message}
        </p>
      )}
      {crewView && !crews.isError && (
        <div className="grid gap-3 lg:grid-cols-2">
          {crews.data?.map((c) => (
            <article key={c.id} className="rounded-xl border bg-card p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 font-semibold">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  {c.name}
                </h2>
                <Badge variant="outline">
                  {c.active ? "Active" : "Inactive"}
                </Badge>
              </div>
              <p className="mt-3 text-sm">
                {c.size && c.dailyCapacityHours
                  ? `${c.size} people × ${quantity(c.dailyCapacityHours)} hours = ${quantity(c.size * c.dailyCapacityHours)} person-hours / day`
                  : "Size and daily capacity need configuration"}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {c.workingDays.length
                  ? c.workingDays.map((d) => weekdays[d]).join(" · ")
                  : "Working days not configured"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {c.timezone} · {c.unavailableDates.length} unavailable dates
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-4"
                onClick={() => openCrew(c)}
              >
                Edit crew
              </Button>
            </article>
          ))}
          {crews.data?.length === 0 && (
            <div className="rounded-xl border border-dashed p-8 text-sm text-muted-foreground">
              No configured crews. Add your first crew to confirm installation
              capacity.
            </div>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          aria-label="Previous seven days"
          onClick={() => {
            const d = new Date(cursor);
            d.setDate(d.getDate() - 7);
            setDate(localDate(d));
          }}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="Next seven days"
          onClick={() => {
            const d = new Date(cursor);
            d.setDate(d.getDate() + 7);
            setDate(localDate(d));
          }}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <label className="flex items-center gap-2 text-sm">
          <span className="sr-only">Seven days starting</span>
          <Input
            type="date"
            className="w-auto"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <Button variant="ghost" onClick={() => setDate(localDate(new Date()))}>
          Today
        </Button>
        <select
          aria-label="Filter crew"
          className={`${selectStyle} sm:w-auto`}
          value={crewFilter}
          onChange={(e) => setCrewFilter(e.target.value)}
        >
          <option value="all">All crews</option>
          {crews.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showCancelled === "yes"}
            onChange={(e) => setShowCancelled(e.target.checked ? "yes" : "no")}
          />
          Show cancelled
        </label>
        {crewView && (
          <Button variant="outline" onClick={() => openBooking()}>
            Book installation
          </Button>
        )}
      </div>
      {bookings.isLoading || crews.isLoading ? (
        <p role="status" className="p-8 text-center text-muted-foreground">
          Loading schedule…
        </p>
      ) : (
        !bookings.isError &&
        !crews.isError && (
          <div className="space-y-4">
            {days.map((day) => {
              const dayBookings = visibleBookings
                .filter(
                  (b) =>
                    dateInZone(
                      b.startAt,
                      crews.data?.find((c) => c.id === b.crewId)?.timezone ??
                        browserZone,
                    ) === day,
                )
                .sort((a, b) => a.startAt.localeCompare(b.startAt));
              return (
                <section
                  key={day}
                  className="grid gap-3 border-t pt-4 lg:grid-cols-[180px_1fr]"
                >
                  <div>
                    <h2 className="font-semibold">
                      {new Date(`${day}T12:00:00`).toLocaleDateString([], {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {
                        dayBookings.filter((b) => b.status === "Confirmed")
                          .length
                      }{" "}
                      confirmed bookings
                    </p>
                  </div>
                  <div className="grid gap-3 xl:grid-cols-2">
                    {dayBookings.map(bookingCard)}
                    {dayBookings.length === 0 && (
                      <p className="py-2 text-sm text-muted-foreground">
                        No bookings for this day.
                      </p>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )
      )}
      {!bookings.isError &&
        !bookings.isLoading &&
        !queryState.jobs.error &&
        !queryState.jobs.isLoading &&
        unconfirmed.length > 0 && (
          <details className="rounded-xl border bg-card p-4">
            <summary className="cursor-pointer font-medium">
              {unconfirmed.length} jobs have unconfirmed estimated dates
            </summary>
            <p className="mt-2 text-sm text-muted-foreground">
              Historical estimated dates do not reserve capacity. Review each
              job and create a booking.
            </p>
            <div className="mt-3 divide-y">
              {unconfirmed.map((j) => (
                <div
                  key={j.id}
                  className="flex flex-wrap justify-between gap-2 py-3 text-sm"
                >
                  <Link
                    href={`/jobs/${j.id}`}
                    className="font-medium hover:underline"
                  >
                    {j.jobNumber} · {j.customerName}
                  </Link>
                  <span className="text-muted-foreground">
                    Estimated {j.estStartDate} · Unconfirmed
                  </span>
                </div>
              ))}
            </div>
          </details>
        )}
      <Dialog
        open={crewOpen}
        onOpenChange={(v) => {
          if (!busy && (v || crewChanges.confirmDiscard())) setCrewOpen(v);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCrew ? "Edit crew" : "Add crew"}</DialogTitle>
            <DialogDescription>
              Capacity is hours per person per day. Leave unknown values blank
              until verified.
            </DialogDescription>
          </DialogHeader>
          <fieldset disabled={busy} className="space-y-3">
            <label className="block space-y-1 text-sm">
              Crew name
              <Input
                value={crewForm.name}
                onChange={(e) =>
                  setCrewForm({ ...crewForm, name: e.target.value })
                }
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1 text-sm">
                People
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={crewForm.size}
                  onChange={(e) =>
                    setCrewForm({ ...crewForm, size: e.target.value })
                  }
                />
              </label>
              <label className="space-y-1 text-sm">
                Hours / person / day
                <Input
                  type="number"
                  min="0.25"
                  max="24"
                  step="0.25"
                  value={crewForm.dailyCapacityHours}
                  onChange={(e) =>
                    setCrewForm({
                      ...crewForm,
                      dailyCapacityHours: e.target.value,
                    })
                  }
                />
              </label>
            </div>
            <label className="block space-y-1 text-sm">
              Time zone
              <Input
                value={crewForm.timezone}
                onChange={(e) =>
                  setCrewForm({ ...crewForm, timezone: e.target.value })
                }
              />
            </label>
            <div>
              <p className="mb-2 text-sm">Working days</p>
              <div className="flex flex-wrap gap-3">
                {weekdays.map((d, i) => (
                  <label key={d} className="flex items-center gap-1 text-sm">
                    <input
                      type="checkbox"
                      checked={crewForm.workingDays.includes(i)}
                      onChange={(e) =>
                        setCrewForm({
                          ...crewForm,
                          workingDays: e.target.checked
                            ? [...crewForm.workingDays, i].sort()
                            : crewForm.workingDays.filter((n) => n !== i),
                        })
                      }
                    />
                    {d}
                  </label>
                ))}
              </div>
            </div>
            <label className="block space-y-1 text-sm">
              Unavailable dates
              <Input
                placeholder="2026-12-25, 2027-01-01"
                value={crewForm.unavailableDates}
                onChange={(e) =>
                  setCrewForm({ ...crewForm, unavailableDates: e.target.value })
                }
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={crewForm.active}
                onChange={(e) =>
                  setCrewForm({ ...crewForm, active: e.target.checked })
                }
              />
              Active crew
            </label>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button onClick={() => save("crew")}>
              {busy ? "Saving…" : "Save crew"}
            </Button>
          </fieldset>
        </DialogContent>
      </Dialog>
      <Dialog
        open={bookingOpen}
        onOpenChange={(v) => {
          if (!busy && (v || bookingChanges.confirmDiscard())) {
            setBookingOpen(v);
            if (!v) updateQuery({ booking: null });
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingBooking ? "Edit installation" : "Book installation"}
            </DialogTitle>
            <DialogDescription>
              Enter one working day per booking. Times below use {browserZone}.
              The crew's time zone governs availability.
            </DialogDescription>
          </DialogHeader>
          <fieldset disabled={busy} className="space-y-3">
            <label className="block space-y-1 text-sm">
              Job
              <select
                className={selectStyle}
                value={bookingForm.jobId}
                onChange={(e) =>
                  setBookingForm({ ...bookingForm, jobId: e.target.value })
                }
              >
                <option value="">Choose job</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.jobNumber} · {j.customerName}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1 text-sm">
              Crew
              <select
                className={selectStyle}
                value={bookingForm.crewId}
                onChange={(e) =>
                  setBookingForm({ ...bookingForm, crewId: e.target.value })
                }
              >
                <option value="">Choose crew</option>
                {crews.data?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.timezone}
                    {!c.active ? " (inactive)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                Start
                <Input
                  type="datetime-local"
                  value={bookingForm.startAt}
                  onChange={(e) =>
                    setBookingForm({ ...bookingForm, startAt: e.target.value })
                  }
                />
              </label>
              <label className="space-y-1 text-sm">
                End
                <Input
                  type="datetime-local"
                  value={bookingForm.endAt}
                  onChange={(e) =>
                    setBookingForm({ ...bookingForm, endAt: e.target.value })
                  }
                />
              </label>
            </div>
            <label className="block space-y-1 text-sm">
              Planned person-hours
              <Input
                type="number"
                min="0.25"
                step="0.25"
                value={bookingForm.plannedLaborHours}
                onChange={(e) =>
                  setBookingForm({
                    ...bookingForm,
                    plannedLaborHours: e.target.value,
                  })
                }
              />
              <span className="text-xs text-muted-foreground">
                Total labor across the crew, for example 2 people × 4 hours = 8
                person-hours.
              </span>
            </label>
            <label className="block space-y-1 text-sm">
              Notes
              <Input
                value={bookingForm.notes}
                onChange={(e) =>
                  setBookingForm({ ...bookingForm, notes: e.target.value })
                }
              />
            </label>
            {editingBooking && (
              <label className="block space-y-1 text-sm">
                Status
                <select
                  className={selectStyle}
                  value={bookingForm.status}
                  onChange={(e) =>
                    setBookingForm({ ...bookingForm, status: e.target.value })
                  }
                >
                  <option>Confirmed</option>
                  <option>Cancelled</option>
                </select>
              </label>
            )}
            {error && (
              <p
                role="alert"
                className="rounded-lg bg-red-50 p-3 text-sm text-red-900"
              >
                {error}
              </p>
            )}
            <Button onClick={() => save("booking")}>
              {busy ? "Checking capacity…" : "Save booking"}
            </Button>
          </fieldset>
        </DialogContent>
      </Dialog>
    </div>
  );
}
