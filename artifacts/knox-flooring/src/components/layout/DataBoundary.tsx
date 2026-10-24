import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

type ReadState = { data?: unknown; isLoading: boolean; isError: boolean; error: unknown; refetch: () => unknown };
export const blocksLoadedData = (query: ReadState) => query.data === undefined || [401, 403].includes((query.error as { status?: number } | null)?.status ?? 0);
export function DataBoundary({ query, name, children }: { query: ReadState; name: string; children: ReactNode }) {
  if (query.isLoading && query.data === undefined) return <div role="status" aria-label={`Loading ${name}`} className="space-y-4"><p className="text-sm text-muted-foreground">Loading {name}…</p><div className="h-12 animate-pulse rounded-lg bg-muted" /><div className="h-64 animate-pulse rounded-lg border bg-white" /></div>;
  if (query.isError && blocksLoadedData(query)) return <div role="alert" className="rounded-lg border bg-white p-6"><h1 className="text-lg font-semibold">Unable to load {name}</h1><p className="mt-2 text-sm text-muted-foreground">{query.error instanceof Error ? query.error.message : "Your records are unchanged. Please try again."}</p><Button className="mt-4" variant="outline" onClick={() => { void query.refetch(); }}>Retry</Button></div>;
  // Keep the same child position during a failed background refresh so editors
  // stay mounted and retain their input, selection, and keyboard focus.
  return <>{query.isError ? <div role="alert" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm"><p>Unable to refresh {name}. Showing the last loaded records; your unsaved input is retained.</p><Button className="mt-2" variant="outline" onClick={() => { void query.refetch(); }}>Retry refresh</Button></div> : null}{children}</>;
}
