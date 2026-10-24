import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { JobCostingDialog } from "./JobCostingDialog";
import type { Job } from "@/lib/types";

const mocks = vi.hoisted(() => ({ updateJob: vi.fn(), close: vi.fn() }));
vi.mock("@/hooks/use-store", () => ({
  useStore: () => ({ updateJob: mocks.updateJob }),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("job costing editor", () => {
  it("keeps focus and exact cents while typing, and retains failed saves", async () => {
    mocks.updateJob.mockRejectedValue(new Error("Connection interrupted"));
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(
      <JobCostingDialog
        open
        job={{ id: "job-1", estRevenue: 1234.56 } as Job}
        onOpenChange={mocks.close}
      />,
    );
    const revenue = screen.getByLabelText("Actual Revenue");
    revenue.focus();
    fireEvent.change(revenue, { target: { value: "1234.56" } });
    expect(screen.getByLabelText("Actual Revenue")).toBe(revenue);
    expect(revenue).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Save Actuals" }));
    await waitFor(() =>
      expect(mocks.updateJob).toHaveBeenCalledWith(
        "job-1",
        expect.objectContaining({ actualRevenue: 1234.56 }),
      ),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Connection interrupted",
    );
    expect(revenue).toHaveValue(1234.56);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mocks.close).not.toHaveBeenCalled();
  });
});
