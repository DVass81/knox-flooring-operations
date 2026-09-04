import { Mail, MessageSquare, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  Communication,
  CommunicationChannel,
  CommunicationStatus,
} from "@/lib/types";

function statusVariant(
  status: CommunicationStatus,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "failed":
      return "destructive";
    case "delivered":
    case "sent":
      return "secondary";
    case "received":
      return "default";
    default:
      return "outline";
  }
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

interface CommunicationsHistoryProps {
  communications: Communication[];
  isLoading?: boolean;
  /** Limit the log to a single channel (e.g. the Emails or SMS tab). */
  channel?: CommunicationChannel;
  emptyLabel?: string;
}

export function CommunicationsHistory({
  communications,
  isLoading,
  channel,
  emptyLabel,
}: CommunicationsHistoryProps) {
  const items = channel
    ? communications.filter((c) => c.channel === channel)
    : communications;

  const sorted = [...items].sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0,
  );

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground">Loading conversation…</p>
    );
  }

  if (sorted.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {emptyLabel ??
          (channel === "email"
            ? "No emails yet."
            : channel === "sms"
              ? "No text messages yet."
              : "No messages yet.")}
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {sorted.map((c) => {
        const inbound = c.direction === "inbound";
        const ChannelIcon = c.channel === "email" ? Mail : MessageSquare;
        return (
          <li
            key={c.id}
            className={cn(
              "rounded-lg border p-3",
              inbound ? "bg-muted/40" : "bg-background",
            )}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <ChannelIcon className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {c.channel === "email" ? "Email" : "SMS"}
              </span>
              <Badge variant="outline" className="gap-1 text-[10px]">
                {inbound ? (
                  <ArrowDownLeft className="w-3 h-3" />
                ) : (
                  <ArrowUpRight className="w-3 h-3" />
                )}
                {inbound ? "Received" : "Sent"}
              </Badge>
              <Badge variant={statusVariant(c.status)} className="text-[10px]">
                {c.status}
              </Badge>
              <span className="ml-auto text-xs text-muted-foreground">
                {formatWhen(c.createdAt)}
              </span>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              {inbound ? "From" : "To"}:{" "}
              <span className="text-foreground">
                {inbound ? c.fromAddress : c.toAddress}
              </span>
            </div>
            {c.channel === "email" && c.subject && (
              <div className="mt-1 text-sm font-semibold">{c.subject}</div>
            )}
            <p className="mt-1 text-sm whitespace-pre-wrap leading-relaxed">
              {c.body}
            </p>
            {c.errorMessage && (
              <p className="mt-2 text-xs text-destructive">{c.errorMessage}</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
