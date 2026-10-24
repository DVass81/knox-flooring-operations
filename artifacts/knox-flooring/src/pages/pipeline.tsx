import { DataBoundary } from "@/components/layout/DataBoundary";
import { useStore } from "@/hooks/use-store";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { STAGE_ORDER } from "@/lib/stages";
import type { Job, JobStatus } from "@/lib/types";
import { useUrlState } from "@/hooks/use-url-state";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function Pipeline() {
  const { queryState, jobs } = useStore();
  const [search, setSearch] = useUrlState<string>("q", "");
  const board = useRef<HTMLDivElement>(null);

  const byStage = STAGE_ORDER.reduce<Record<JobStatus, Job[]>>(
    (acc, stage) => {
      acc[stage] = [];
      return acc;
    },
    {} as Record<JobStatus, Job[]>
  );
  for (const job of jobs) {
    if (![job.customerName, job.jobNumber, job.city].some((value) => value.toLowerCase().includes(search.trim().toLowerCase()))) continue;
    if (byStage[job.status]) byStage[job.status].push(job);
  }

  return (
    <DataBoundary query={queryState.jobs} name="jobs">
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
          Jobs board
        </h1>
        <p className="text-muted-foreground mt-1">
          Every job grouped by its current stage.
        </p>
      </div>

      <div className="flex items-center justify-between gap-3"><Input value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search jobs board" placeholder="Search customer, job number, city" className="max-w-sm bg-white" /><div className="flex gap-1"><Button variant="outline" size="icon" aria-label="Scroll job stages left" onClick={() => board.current?.scrollBy({ left: -304, behavior: "smooth" })}><ChevronLeft /></Button><Button variant="outline" size="icon" aria-label="Scroll job stages right" onClick={() => board.current?.scrollBy({ left: 304, behavior: "smooth" })}><ChevronRight /></Button></div></div>
      <div ref={board} tabIndex={0} aria-label="Job stages" className="flex gap-4 overflow-x-auto pb-4">
        {STAGE_ORDER.map((stage) => {
          const stageJobs = byStage[stage];
          return (
            <div key={stage} className="w-72 shrink-0">
              <div className="flex items-center justify-between mb-3 px-1">
                <h2 className="text-sm font-semibold text-foreground">{stage}</h2>
                <Badge variant="secondary" className="text-xs">
                  {stageJobs.length}
                </Badge>
              </div>
              <div className="space-y-3 bg-muted/30 rounded-lg border p-2 min-h-[120px]">
                {stageJobs.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">
                    No jobs
                  </p>
                ) : (
                  stageJobs.map((job) => (
                    <Link
                      key={job.id}
                      href={`/jobs/${job.id}`}
                      className="block bg-card rounded-md border shadow-sm p-3 hover:border-primary/50 hover:shadow transition-all"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-primary">
                          {job.jobNumber}
                        </span>
                        {job.priorityLevel === "High" && (
                          <Badge variant="destructive" className="text-[10px]">
                            High
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-foreground mt-1 truncate">
                        {job.customerName}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {job.city} · {job.flooringType}
                      </p>
                      <p className="text-xs font-medium text-foreground mt-2">
                        ${job.estRevenue.toLocaleString()}
                      </p>
                    </Link>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
    </DataBoundary>
  );
}
