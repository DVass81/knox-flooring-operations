import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { STAGE_ORDER, stageIndex, stageProgressPct } from "@/lib/stages";
import type { JobStatus } from "@/lib/types";

export function StagePipeline({ current }: { current: JobStatus }) {
  const activeIdx = stageIndex(current);
  const pct = stageProgressPct(current);

  return (
    <div className="space-y-4">
      <div className="relative h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {STAGE_ORDER.map((stage, idx) => {
          const isDone = idx < activeIdx;
          const isActive = idx === activeIdx;
          return (
            <div
              key={stage}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                isActive && "border-primary bg-primary text-primary-foreground",
                isDone && "border-primary/30 bg-primary/10 text-primary",
                !isActive && !isDone && "border-border bg-muted/40 text-muted-foreground"
              )}
            >
              {isDone && <Check className="w-3 h-3" />}
              {stage}
            </div>
          );
        })}
      </div>
    </div>
  );
}
