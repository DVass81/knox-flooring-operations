import { useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import type { EstimateInput, EstimateSnapshot } from "@workspace/domain";
import { useAuth } from "@/contexts/auth";

export interface Customer { id: string; name: string; email: string; phone: string; notes: string; revision: number; mergedIntoId?: string | null }
export interface CustomerSite { id: string; customerId: string; label: string; address: string; city: string; state: string; zip: string }
export interface Crew { id: string; name: string; active: boolean; timezone: string; size: number | null; dailyCapacityHours: number | null; workingDays: number[]; unavailableDates: string[]; revision: number }
export interface Booking { id: string; crewId: string; jobId: string; startAt: string; endAt: string; plannedLaborHours: number; status: string; notes: string; revision: number; taskId?: string; calendarSyncStatus?: string; calendarSyncError?: string | null }
export interface StockSummary { productId: string; onHand: number; reserved: number; available: number; reorderPoint: number | null; status: string }
export interface StockMovement { id: string; productId: string; jobId: string | null; quantity: number; kind: string; reason: string; createdAt: string }
export interface Reservation { id: string; productId: string; jobId: string; quantity: number; status: string; revision: number }
export interface EstimateDraft { id: string; title: string; inputs: EstimateInput; snapshot: EstimateSnapshot | null; revision: number; state: string; updatedAt: string; convertedProposalId?: string; convertedJobId?: string }
export interface Callback { id: string; jobId: string; reason: string; status: string; assignedTo: string; notes: string; resolvedAt?: string }
export function operation<T>(path: string, method = "GET", data?: unknown): Promise<T> {
  return customFetch<T>(`/api${path}`, { method, responseType: "json", ...(data === undefined ? {} : { body: JSON.stringify(data), headers: { "Content-Type": "application/json" } }) });
}
export function useOperation<T>(path: string, roles?: string[]) {
  const { user } = useAuth();
  const allowed = Boolean(user && (!roles || roles.includes(user.role)));
  const query = useQuery({ queryKey: ["operations", user?.id, user?.role, path], queryFn: () => operation<T>(path), enabled: allowed, retry: false });
  return { ...query, data: allowed ? query.data : undefined, allowed };
}
export function useRefreshOperations() {
  const client = useQueryClient();
  return () => client.invalidateQueries();
}
export const currency = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
export const quantity = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 3 });
