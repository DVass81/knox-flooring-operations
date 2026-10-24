import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FilterSummary({ count, noun, filters, onClear }: { count: number; noun: string; filters: { label: string; clear(): void }[]; onClear(): void }) {
  return <div className="flex min-h-9 flex-wrap items-center gap-2 text-sm" aria-live="polite">
    <span className="mr-2 text-muted-foreground">{count} {noun}</span>
    {filters.map((filter) => <button key={filter.label} type="button" onClick={filter.clear} className="inline-flex min-h-9 items-center gap-2 rounded-md border bg-white px-3 text-xs" aria-label={`Remove filter: ${filter.label}`}>{filter.label}<X className="h-3 w-3" /></button>)}
    {filters.length > 0 && <Button variant="ghost" size="sm" onClick={onClear}>Clear filters</Button>}
  </div>;
}
