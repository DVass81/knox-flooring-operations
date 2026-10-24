import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import type { EstimateInput } from "@workspace/domain";
const mocks = vi.hoisted(() => ({ operation: vi.fn(), user: { id: "user-one", role: "owner" } }));
vi.mock("@/contexts/auth", () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock("@/lib/operations", () => ({ operation: mocks.operation }));
import { useEstimateDraft } from "./use-estimate-draft";
const initial: EstimateInput = { customerName: "", city: "", flooringType: "Hardwood", rooms: [], wastePercent: 10, laborRate: 2, targetMarginPercent: 25, lines: [], allowances: [], notes: "", policyVersion: 1 };
const draft = (inputs = initial, revision = 1) => ({ id: "draft-one", title: "Draft", inputs, revision, state: "Draft", updatedAt: "2026-10-23T12:00:00Z" });
beforeEach(() => { localStorage.clear(); mocks.operation.mockReset(); });
afterEach(() => { vi.useRealTimers(); });

describe("recoverable estimate drafts", () => {
  it("opens a distinct explicit new estimate without replacing the old recovery buffer", async () => {
    const { result, rerender, unmount } = renderHook(({ key }) => useEstimateDraft(null, initial, true, key), { initialProps: { key: "first" } });
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.update({ ...initial, customerName: "Unfinished first estimate" }));
    await waitFor(() => expect(localStorage.getItem("catalyst:estimate:user-one:new:first")).toContain("Unfinished first estimate"));
    rerender({ key: "second" });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.inputs.customerName).toBe("");
    expect(localStorage.getItem("catalyst:estimate:user-one:new:first")).toContain("Unfinished first estimate");
    unmount();
  });
  it("uses context only for a fresh draft and keeps resumed or recovered inputs", async () => {
    const context = { ...initial, customerId: "context-customer", siteId: "context-site", leadId: "context-lead", customerName: "Context customer" };
    const fresh = renderHook(() => useEstimateDraft(null, context, true));
    await waitFor(() => expect(fresh.result.current.loading).toBe(false));
    expect(fresh.result.current.inputs).toEqual(context);
    fresh.unmount();
    mocks.operation.mockResolvedValue(draft({ ...initial, customerName: "Saved customer" }));
    const resumed = renderHook(() => useEstimateDraft("draft-one", context, true));
    await waitFor(() => expect(resumed.result.current.loading).toBe(false));
    expect(resumed.result.current.inputs.customerName).toBe("Saved customer");
    resumed.unmount();
    localStorage.setItem("catalyst:estimate:user-one:new", JSON.stringify({ inputs: { ...initial, customerName: "Recovered customer" }, id: "pending" }));
    const recovered = renderHook(() => useEstimateDraft(null, context, true));
    await waitFor(() => expect(recovered.result.current.loading).toBe(false));
    expect(recovered.result.current.inputs.customerName).toBe("Recovered customer");
    recovered.unmount();
  });
  it("autosaves one debounced revision and clears a successfully saved local buffer", async () => {
    mocks.operation.mockImplementation(async (_path, _method, body) => draft(body.inputs));
    const { result, unmount } = renderHook(() => useEstimateDraft(null, initial, true));
    await waitFor(() => expect(result.current.loading).toBe(false)); vi.useFakeTimers();
    act(() => result.current.update({ ...initial, customerName: "Alice" }));
    act(() => result.current.update({ ...initial, customerName: "Alice Smith" }));
    expect(localStorage.getItem("catalyst:estimate:user-one:new")).toContain("Alice Smith");
    await act(() => vi.advanceTimersByTimeAsync(950));
    expect(mocks.operation).toHaveBeenCalledTimes(1); expect(result.current.status).toBe("Saved");
    expect(localStorage.getItem("catalyst:estimate:user-one:new")).toBeNull(); unmount();
  });
  it("recovers interrupted edits and prevents stale revisions from overwriting another tab", async () => {
    const pending = { ...initial, customerName: "Recovered customer" };
    localStorage.setItem("catalyst:estimate:user-one:draft-one", JSON.stringify({ inputs: pending, revision: 1, id: "draft-one" }));
    mocks.operation.mockResolvedValue(draft({ ...initial, customerName: "Other tab" }, 2));
    const { result, unmount } = renderHook(() => useEstimateDraft("draft-one", initial, true));
    await waitFor(() => expect(result.current.status).toBe("Conflict"));
    expect(result.current.inputs.customerName).toBe("Recovered customer");
    act(() => result.current.update(old => ({ ...old, notes: "Keep my changes" })));
    expect(result.current.status).toBe("Conflict");
    await expect(result.current.persist()).rejects.toThrow("Resolve the draft conflict");
    expect(mocks.operation).toHaveBeenCalledTimes(1); unmount();
  });
  it("retains input after a server error and retries with the same creation identifier", async () => {
    mocks.operation.mockRejectedValueOnce(new Error("Saving unavailable"));
    const { result, unmount } = renderHook(() => useEstimateDraft(null, initial, true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.update({ ...initial, customerName: "Keep this" }));
    await act(async () => { await result.current.persist().catch(() => {}); });
    expect(result.current.status).toBe("Save failed"); expect(result.current.inputs.customerName).toBe("Keep this");
    const firstId = mocks.operation.mock.calls[0][2].id;
    mocks.operation.mockImplementation(async (_path, _method, body) => draft(body.inputs));
    await act(async () => { await result.current.persist(); });
    expect(mocks.operation.mock.calls[1][2].id).toBe(firstId); expect(result.current.status).toBe("Saved"); unmount();
  });
  it("restores the saved revision for a pending newly-created draft after reload", async () => {
    localStorage.setItem("catalyst:estimate:user-one:new", JSON.stringify({ inputs: { ...initial, notes: "Pending" }, revision: 3, id: "draft-one" }));
    mocks.operation.mockResolvedValue(draft(initial, 3));
    const { result, unmount } = renderHook(() => useEstimateDraft(null, initial, true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mocks.operation).toHaveBeenCalledWith("/estimate-drafts/draft-one");
    expect(result.current.inputs.notes).toBe("Pending"); expect(result.current.draft?.revision).toBe(3); unmount();
  });
});
