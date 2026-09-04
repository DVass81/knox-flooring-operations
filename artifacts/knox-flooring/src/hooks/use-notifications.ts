import { useCallback, useMemo, useState } from "react";
import { useStore } from "@/hooks/use-store";
import {
  buildNotifications,
  type AppNotification,
} from "@/lib/notifications";

const READ_KEY = "knox.notifications.read.v1";
const CLEARED_KEY = "knox.notifications.cleared.v1";

function loadIds(key: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function saveIds(key: string, ids: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(Array.from(ids)));
  } catch {
    /* storage unavailable — read-state simply won't persist */
  }
}

export interface VisibleNotification extends AppNotification {
  read: boolean;
}

export function useNotifications() {
  const { leads, invoices, jobs, materials } = useStore();
  const [readIds, setReadIds] = useState<Set<string>>(() => loadIds(READ_KEY));
  const [clearedIds, setClearedIds] = useState<Set<string>>(() =>
    loadIds(CLEARED_KEY),
  );

  const all = useMemo(
    () => buildNotifications({ leads, invoices, jobs, materials }),
    [leads, invoices, jobs, materials],
  );

  // Note: read/cleared ids are persisted as-is and never auto-pruned. Pruning
  // against the live notification set is unsafe because the store data loads
  // asynchronously — during the initial empty render it would wipe valid
  // read-state. Notification ids are stable per event, so persisting them
  // directly keeps already-seen items read across reloads.
  const notifications = useMemo<VisibleNotification[]>(
    () =>
      all
        .filter((n) => !clearedIds.has(n.id))
        .map((n) => ({ ...n, read: readIds.has(n.id) })),
    [all, clearedIds, readIds],
  );

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  const markRead = useCallback((id: string) => {
    setReadIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev).add(id);
      saveIds(READ_KEY, next);
      return next;
    });
  }, []);

  const markAllRead = useCallback(() => {
    setReadIds((prev) => {
      const next = new Set(prev);
      for (const n of all) next.add(n.id);
      saveIds(READ_KEY, next);
      return next;
    });
  }, [all]);

  const clear = useCallback((id: string) => {
    setClearedIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev).add(id);
      saveIds(CLEARED_KEY, next);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setClearedIds((prev) => {
      const next = new Set(prev);
      for (const n of all) next.add(n.id);
      saveIds(CLEARED_KEY, next);
      return next;
    });
  }, [all]);

  return {
    notifications,
    unreadCount,
    markRead,
    markAllRead,
    clear,
    clearAll,
  };
}
