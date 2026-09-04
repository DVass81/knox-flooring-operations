import { useState } from "react";
import { useLocation } from "wouter";
import {
  Bell,
  CheckCheck,
  Clock,
  UserPlus,
  Receipt,
  CalendarClock,
  KanbanSquare,
  PackageX,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  useNotifications,
  type VisibleNotification,
} from "@/hooks/use-notifications";
import {
  formatRelativeTime,
  type NotificationType,
} from "@/lib/notifications";

const ICONS: Record<NotificationType, LucideIcon> = {
  "lead-followup": Clock,
  "lead-new": UserPlus,
  "invoice-overdue": Receipt,
  "invoice-due-soon": CalendarClock,
  "job-stage": KanbanSquare,
  "material-delay": PackageX,
};

const SEVERITY_STYLES = {
  critical: "bg-destructive/10 text-destructive",
  warning: "bg-amber-500/15 text-amber-600",
  info: "bg-primary/10 text-primary",
} as const;

function isToday(iso: string): boolean {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

function NotificationRow({
  notification,
  onSelect,
  onClear,
}: {
  notification: VisibleNotification;
  onSelect: (n: VisibleNotification) => void;
  onClear: (id: string) => void;
}) {
  const Icon = ICONS[notification.type];
  return (
    <div
      className={cn(
        "group flex items-stretch transition-colors hover:bg-muted/60",
        !notification.read && "bg-primary/[0.04]",
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(notification)}
        className="flex min-w-0 flex-1 gap-3 px-4 py-3 text-left focus:outline-none focus-visible:bg-muted/60"
      >
        <span
          className={cn(
            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
            SEVERITY_STYLES[notification.severity],
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <p
              className={cn(
                "text-sm leading-snug text-foreground",
                !notification.read && "font-semibold",
              )}
            >
              {notification.title}
            </p>
            {!notification.read && (
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {notification.description}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground/70">
            {formatRelativeTime(notification.timestamp)}
          </p>
        </div>
      </button>
      <button
        type="button"
        aria-label="Clear notification"
        onClick={() => onClear(notification.id)}
        className="flex w-9 shrink-0 items-start justify-center pt-3 text-muted-foreground/50 opacity-0 transition hover:text-foreground group-hover:opacity-100 focus:opacity-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();
  const { notifications, unreadCount, markRead, markAllRead, clear, clearAll } =
    useNotifications();

  const todays = notifications.filter((n) => isToday(n.timestamp));
  const earlier = notifications.filter((n) => !isToday(n.timestamp));

  const handleSelect = (n: VisibleNotification) => {
    markRead(n.id);
    setOpen(false);
    navigate(n.link);
  };

  const renderGroup = (label: string, items: VisibleNotification[]) => {
    if (items.length === 0) return null;
    return (
      <div>
        <div className="sticky top-0 z-10 bg-background/95 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur">
          {label}
        </div>
        <div className="divide-y divide-border/60">
          {items.map((n) => (
            <NotificationRow
              key={n.id}
              notification={n}
              onSelect={handleSelect}
              onClear={clear}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        >
          <Bell className="h-5 w-5 text-muted-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[360px] max-w-[calc(100vw-2rem)] p-0"
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                {unreadCount} new
              </span>
            )}
          </div>
          {notifications.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={markAllRead}
              disabled={unreadCount === 0}
            >
              <CheckCheck className="mr-1 h-3.5 w-3.5" /> Mark all read
            </Button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Bell className="h-6 w-6 text-muted-foreground/60" />
            </span>
            <p className="text-sm font-medium text-foreground">All caught up</p>
            <p className="text-xs text-muted-foreground">
              You have no new notifications right now.
            </p>
          </div>
        ) : (
          <>
            <ScrollArea className="max-h-[60vh]">
              {renderGroup("Today", todays)}
              {renderGroup("Earlier", earlier)}
            </ScrollArea>
            <div className="border-t px-2 py-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs text-muted-foreground hover:text-foreground"
                onClick={clearAll}
              >
                Clear all
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
