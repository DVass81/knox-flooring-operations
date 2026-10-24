import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TaskCalendar from "./task-calendar";
import type { Task } from "@/lib/types";

const mocks = vi.hoisted(() => ({ addTask: vi.fn(), updateTask: vi.fn(), navigate: vi.fn(), tasks: [] as Task[] }));
vi.mock("wouter", () => ({ useLocation: () => ["/tasks", mocks.navigate], useSearch: () => window.location.search }));
vi.mock("@/contexts/auth", () => ({ useAuth: () => ({ user: { role: "owner" } }) }));
vi.mock("@/hooks/use-store", () => ({ useStore: () => ({ salespeople: [], leads: [] }), useTasks: () => ({ tasks: mocks.tasks, addTask: mocks.addTask, updateTask: mocks.updateTask, deleteTask: vi.fn(), isLoading: false, error: null, refetch: vi.fn() }), useGoogleCalendar: () => ({ status: null, isLoading: false }) }));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} }); mocks.tasks = []; window.history.replaceState({}, "", "/tasks"); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("task editor", () => {
  it("preserves a lead relationship when opening from the header Create action", async () => {
    window.history.replaceState({}, "", "/tasks?create=1&leadId=lead-1");
    render(<TaskCalendar />);
    fireEvent.change(await screen.findByLabelText("Title"), { target: { value: "Follow up" } });
    fireEvent.click(screen.getByRole("button", { name: /^Add Task$/ }));
    await waitFor(() => expect(mocks.addTask).toHaveBeenCalledWith(expect.objectContaining({ relatedLeadId: "lead-1", title: "Follow up" })));
  });
  it("opens from Create with context and retains unsaved fields after a failed request", async () => {
    window.history.replaceState({}, "", "/tasks?create=1&jobId=job-1");
    mocks.addTask.mockRejectedValue(new Error("Connection interrupted"));
    render(<TaskCalendar />);
    expect(await screen.findByRole("dialog", { name: "New Task" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Call customer" } });
    fireEvent.click(screen.getByRole("button", { name: /^Add Task$/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Connection interrupted");
    expect(screen.getByLabelText("Title")).toHaveValue("Call customer");
    expect(mocks.addTask).toHaveBeenCalledWith(expect.objectContaining({ relatedJobId: "job-1", title: "Call customer" }));
  });
  it("rejects an end before the start rather than silently altering the dates", async () => {
    window.history.replaceState({}, "", "/tasks?create=1"); render(<TaskCalendar />);
    fireEvent.change(await screen.findByLabelText("Title"), { target: { value: "Call customer" } });
    fireEvent.change(screen.getByLabelText("Start"), { target: { value: "2026-10-23T14:00" } });
    fireEvent.change(screen.getByLabelText("End"), { target: { value: "2026-10-23T13:00" } });
    fireEvent.click(screen.getByRole("button", { name: /^Add Task$/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("End time must be after");
    expect(mocks.addTask).not.toHaveBeenCalled();
  });
  it("routes a linked installation task through booking controls", async () => {
    window.history.replaceState({}, "", "/tasks?date=2026-10-23");
    mocks.tasks = [{ id: "task-1", title: "Install kitchen", description: "", startAt: "2026-10-23T14:00:00Z", endAt: "2026-10-23T16:00:00Z", status: "Open", allDay: false, bookingId: "booking-1", relatedJobId: "job-1", createdAt: "", updatedAt: "" }];
    render(<TaskCalendar />);
    fireEvent.click(screen.getByRole("button", { name: /Install kitchen/ }));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith("/calendar?booking=booking-1"));
    expect(mocks.updateTask).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
