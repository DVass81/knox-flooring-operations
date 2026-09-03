import { logger } from "./logger";

// Two-way Google Calendar sync.
//
// We talk to the Google Calendar REST API directly using an OAuth access token
// obtained from the Replit connectors proxy (the same mechanism the email/SMS
// integrations use). No API keys live in app code. The token is short-lived and
// refreshed automatically by the connectors service, so we never cache it for
// long. See the `integrations` setup for connecting the Google Calendar account.

const CAL_API = "https://www.googleapis.com/calendar/v3";
const CALENDAR_ID = "primary";

/** Marker stored on every event we create so we can recognise our own tasks. */
const TASK_ID_PROP = "knoxTaskId";
const ASSIGNEE_PROP = "knoxAssigneeId";

export class GoogleCalendarError extends Error {
  status: number;
  /** True when the stored sync token expired and a full resync is required. */
  syncTokenExpired: boolean;
  constructor(message: string, status = 502, syncTokenExpired = false) {
    super(message);
    this.name = "GoogleCalendarError";
    this.status = status;
    this.syncTokenExpired = syncTokenExpired;
  }
}

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}
let cachedToken: CachedToken | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.accessToken;
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!hostname || !xReplitToken) {
    throw new GoogleCalendarError(
      "Google Calendar is not connected. Connect it in the integrations panel to enable sync.",
      503,
    );
  }

  let data: {
    items?: Array<{
      settings?: {
        access_token?: string;
        expires_at?: string;
        oauth?: { credentials?: { access_token?: string; expiry_date?: number } };
      };
    }>;
  };
  try {
    const res = await fetch(
      `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=google-calendar`,
      { headers: { Accept: "application/json", X_REPLIT_TOKEN: xReplitToken } },
    );
    data = (await res.json()) as typeof data;
  } catch {
    throw new GoogleCalendarError(
      "Could not reach the Google Calendar connection service.",
      503,
    );
  }

  const settings = data.items?.[0]?.settings;
  const accessToken =
    settings?.access_token ?? settings?.oauth?.credentials?.access_token;

  if (!accessToken) {
    throw new GoogleCalendarError(
      "Google Calendar is not connected. Connect it in the integrations panel to enable sync.",
      503,
    );
  }

  const expiresAt = settings?.expires_at
    ? new Date(settings.expires_at).getTime()
    : settings?.oauth?.credentials?.expiry_date
      ? settings.oauth.credentials.expiry_date
      : Date.now() + 5 * 60_000;

  cachedToken = { accessToken, expiresAt };
  return accessToken;
}

export async function isGoogleCalendarConnected(): Promise<boolean> {
  try {
    await getAccessToken();
    return true;
  } catch {
    return false;
  }
}

async function calFetch(
  path: string,
  init: RequestInit & { query?: Record<string, string | undefined> } = {},
): Promise<unknown> {
  const token = await getAccessToken();
  const { query, ...rest } = init;
  const url = new URL(`${CAL_API}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) url.searchParams.set(k, v);
    }
  }

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      ...rest,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(rest.headers ?? {}),
      },
    });
  } catch {
    throw new GoogleCalendarError(
      "Could not reach Google Calendar. Check the connection and try again.",
      503,
    );
  }

  if (res.status === 401 || res.status === 403) {
    cachedToken = null;
    throw new GoogleCalendarError(
      "Google Calendar authorization expired. Reconnect it in the integrations panel.",
      503,
    );
  }
  if (res.status === 410) {
    // Sync token expired — caller must perform a full resync.
    throw new GoogleCalendarError("Sync token expired", 410, true);
  }
  if (res.status === 204) return null;
  if (!res.ok) {
    const detail = await safeText(res);
    logger.warn({ status: res.status, detail }, "Google Calendar API error");
    throw new GoogleCalendarError(`Google Calendar error: ${detail}`, 502);
  }
  if (res.headers.get("content-length") === "0") return null;
  return res.json();
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return `HTTP ${res.status}`;
  }
}

// ---------------------------------------------------------------------------
// Event <-> Task mapping
// ---------------------------------------------------------------------------

export interface GEventTime {
  date?: string;
  dateTime?: string;
  timeZone?: string;
}
export interface GEvent {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  start?: GEventTime;
  end?: GEventTime;
  extendedProperties?: { private?: Record<string, string> };
}

export interface TaskLike {
  id: string;
  title: string;
  description: string;
  assigneeId?: string | null;
  startAt: string;
  endAt: string;
  allDay: boolean;
}

function dateOnly(iso: string): string {
  // Use the UTC date portion to keep all-day boundaries stable.
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function addDaysToDateOnly(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function taskToEventBody(task: TaskLike): Record<string, unknown> {
  const extendedPrivate: Record<string, string> = { [TASK_ID_PROP]: task.id };
  if (task.assigneeId) extendedPrivate[ASSIGNEE_PROP] = task.assigneeId;

  const body: Record<string, unknown> = {
    summary: task.title,
    description: task.description || undefined,
    extendedProperties: { private: extendedPrivate },
  };

  if (task.allDay) {
    const startDate = dateOnly(task.startAt);
    // Google all-day end date is exclusive — add one day past the inclusive end.
    const endDate = addDaysToDateOnly(dateOnly(task.endAt), 1);
    body.start = { date: startDate };
    body.end = { date: endDate };
  } else {
    body.start = { dateTime: new Date(task.startAt).toISOString() };
    body.end = { dateTime: new Date(task.endAt).toISOString() };
  }
  return body;
}

export interface EventToTaskFields {
  title: string;
  description: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  assigneeId: string | null;
}

export function eventToTaskFields(event: GEvent): EventToTaskFields {
  const allDay = Boolean(event.start?.date);
  let startAt: string;
  let endAt: string;
  if (allDay) {
    const startDate = event.start?.date ?? dateOnly(new Date().toISOString());
    const endExclusive = event.end?.date ?? addDaysToDateOnly(startDate, 1);
    const endInclusive = addDaysToDateOnly(endExclusive, -1);
    startAt = `${startDate}T00:00:00.000Z`;
    endAt = `${endInclusive}T23:59:59.000Z`;
  } else {
    startAt = event.start?.dateTime
      ? new Date(event.start.dateTime).toISOString()
      : new Date().toISOString();
    endAt = event.end?.dateTime
      ? new Date(event.end.dateTime).toISOString()
      : startAt;
  }

  return {
    title: event.summary?.trim() || "(no title)",
    description: event.description ?? "",
    startAt,
    endAt,
    allDay,
    assigneeId: event.extendedProperties?.private?.[ASSIGNEE_PROP] ?? null,
  };
}

export function getEventTaskId(event: GEvent): string | null {
  return event.extendedProperties?.private?.[TASK_ID_PROP] ?? null;
}

// ---------------------------------------------------------------------------
// REST operations
// ---------------------------------------------------------------------------

export async function gcalInsertEvent(task: TaskLike): Promise<string> {
  const event = (await calFetch(`/calendars/${CALENDAR_ID}/events`, {
    method: "POST",
    body: JSON.stringify(taskToEventBody(task)),
  })) as GEvent;
  return event.id;
}

export async function gcalPatchEvent(
  eventId: string,
  task: TaskLike,
): Promise<void> {
  await calFetch(
    `/calendars/${CALENDAR_ID}/events/${encodeURIComponent(eventId)}`,
    { method: "PATCH", body: JSON.stringify(taskToEventBody(task)) },
  );
}

export async function gcalDeleteEvent(eventId: string): Promise<void> {
  try {
    await calFetch(
      `/calendars/${CALENDAR_ID}/events/${encodeURIComponent(eventId)}`,
      { method: "DELETE" },
    );
  } catch (err) {
    // Already gone on the Google side is fine.
    if (err instanceof GoogleCalendarError && err.status === 502) return;
    if (err instanceof GoogleCalendarError && err.status === 404) return;
  }
}

export interface ListChangesResult {
  events: GEvent[];
  nextSyncToken: string | null;
}

/**
 * List changed events. When `syncToken` is provided, performs an incremental
 * sync (returns only changes, including cancellations). Otherwise performs a
 * bounded full sync of recent + upcoming events.
 */
export async function gcalListChanges(
  syncToken: string | null,
): Promise<ListChangesResult> {
  const events: GEvent[] = [];
  let pageToken: string | undefined;
  let nextSyncToken: string | null = null;

  // For a full sync, bound the window so we don't pull years of history.
  const timeMin = syncToken
    ? undefined
    : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  do {
    const query: Record<string, string | undefined> = {
      singleEvents: "true",
      maxResults: "250",
      pageToken,
    };
    if (syncToken) {
      query.syncToken = syncToken;
    } else {
      query.timeMin = timeMin;
      query.showDeleted = "false";
    }

    const data = (await calFetch(`/calendars/${CALENDAR_ID}/events`, {
      method: "GET",
      query,
    })) as {
      items?: GEvent[];
      nextPageToken?: string;
      nextSyncToken?: string;
    };

    if (data.items) events.push(...data.items);
    pageToken = data.nextPageToken;
    if (data.nextSyncToken) nextSyncToken = data.nextSyncToken;
  } while (pageToken);

  return { events, nextSyncToken };
}
