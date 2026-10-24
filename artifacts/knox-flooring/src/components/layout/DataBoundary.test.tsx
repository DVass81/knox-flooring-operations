import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DataBoundary } from "./DataBoundary";

afterEach(cleanup);
describe("record refresh feedback", () => {
  it("retains the same editor, input and focus after a failed refresh and recovery", () => {
    const refetch = vi.fn();
    const query = { data: [], isLoading: false, isError: false, error: null as unknown, refetch };
    const view = (state: typeof query) => <DataBoundary query={state} name="invoices"><input aria-label="Invoice note" defaultValue="Original" /></DataBoundary>;
    const { rerender } = render(view(query));
    const input = screen.getByLabelText("Invoice note");
    input.focus();
    fireEvent.change(input, { target: { value: "Unfinished work" } });
    rerender(view({ ...query, isError: true, error: new Error("Network interrupted") }));
    expect(screen.getByRole("alert")).toHaveTextContent("last loaded records");
    expect(screen.getByLabelText("Invoice note")).toBe(input);
    expect(input).toHaveValue("Unfinished work");
    expect(input).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Retry refresh" }));
    expect(refetch).toHaveBeenCalledOnce();
    rerender(view(query));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Invoice note")).toBe(input);
    expect(input).toHaveValue("Unfinished work");
  });

  it("does not expose cached records after access is revoked or invent empty data on initial failure", () => {
    const query = { data: [{}], isLoading: false, isError: true, error: { status: 403 }, refetch: vi.fn() };
    const { rerender } = render(<DataBoundary query={query} name="records"><p>Private record</p></DataBoundary>);
    expect(screen.queryByText("Private record")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Unable to load");
    rerender(<DataBoundary query={{ ...query, data: undefined, error: new Error("Offline") }} name="records"><p>No records</p></DataBoundary>);
    expect(screen.queryByText("No records")).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Offline");
  });
});
