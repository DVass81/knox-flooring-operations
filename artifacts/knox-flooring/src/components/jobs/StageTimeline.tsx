import { cn } from "@/lib/utils";
import { formatStageDateTime } from "@/lib/stages";
import type { StageEvent } from "@/lib/types";

export function StageTimeline({ history }: { history: StageEvent[] }) {
  if (!history || history.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No stage history recorded yet.</p>
    );
  }
  const ordered = [...history].sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
  );

  return (
    <ol className="relative space-y-5 pl-6">
      <span className="absolute left-[7px] top-1.5 bottom-1.5 w-px bg-border" />
      {ordered.map((event, idx) => {
        const isLatest = idx === 0;
        return (
          <li key={`${event.stage}-${event.at}`} className="relative">
            <span
              className={cn(
                "absolute -left-6 top-1 w-3.5 h-3.5 rounded-full border-2",
                isLatest
                  ? "bg-primary border-primary"
                  : "bg-background border-muted-foreground/40"
              )}
            />
            <div className="text-sm font-medium text-foreground">{event.stage}</div>
            <div className="text-xs text-muted-foreground">
              {formatStageDateTime(event.at)}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
