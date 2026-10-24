export class DomainError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}
export function assertRevision(actual: number, expected: number | undefined) {
  if (expected !== undefined && actual !== expected)
    throw new DomainError(409, "This record changed. Refresh before saving.", {
      revision: actual,
    });
}
export function overlaps(
  a: { startAt: string; endAt: string },
  b: { startAt: string; endAt: string },
) {
  return (
    Date.parse(a.startAt) < Date.parse(b.endAt) &&
    Date.parse(b.startAt) < Date.parse(a.endAt)
  );
}
export function stockAvailability(
  onHand: number,
  reservations: Array<{ quantity: number; status: string }>,
) {
  const reserved = reservations
    .filter((r) => r.status === "Active")
    .reduce((sum, r) => sum + r.quantity, 0);
  return {
    onHand,
    reserved,
    available: Math.round((onHand - reserved) * 1e6) / 1e6,
  };
}
export function movementDelta(kind: string, quantity: number) {
  if (!Number.isFinite(quantity) || quantity === 0)
    throw new DomainError(400, "Quantity must be a finite nonzero number.");
  if (kind !== "adjustment" && quantity < 0)
    throw new DomainError(
      400,
      "Enter a positive quantity for receipts, returns, and consumption.",
    );
  if (!["receipt", "return", "consume", "adjustment"].includes(kind))
    throw new DomainError(400, "Unsupported inventory movement.");
  return kind === "consume" ? -quantity : quantity;
}
export function assertBooking(input: {
  startAt: string;
  endAt: string;
  plannedLaborHours: number;
}) {
  const duration =
    (Date.parse(input.endAt) - Date.parse(input.startAt)) / 3600000;
  if (!Number.isFinite(duration) || duration <= 0)
    throw new DomainError(400, "End time must be after start time.");
  if (!Number.isFinite(input.plannedLaborHours) || input.plannedLaborHours <= 0)
    throw new DomainError(400, "Planned labor hours must be positive.");
  return duration;
}
export function eventDate(
  job: {
    soldAt?: string | null;
    completedAt?: string | null;
    stageHistory: Array<{ stage: string; at: string }>;
  },
  type: "sold" | "completed",
) {
  const explicit = type === "sold" ? job.soldAt : job.completedAt;
  if (explicit) return explicit;
  const events = job.stageHistory
    .filter(
      (e) =>
        e.stage === (type === "sold" ? "Approved" : "Completed") &&
        Number.isFinite(Date.parse(e.at)),
    )
    .sort((a, b) => a.at.localeCompare(b.at));
  return (type === "sold" ? events[0] : events.at(-1))?.at ?? null;
}
export function withinPeriod(
  date: string | null | undefined,
  from: string,
  to: string,
) {
  return Boolean(
    date &&
    Date.parse(date) >= Date.parse(from) &&
    Date.parse(date) < Date.parse(to),
  );
}
