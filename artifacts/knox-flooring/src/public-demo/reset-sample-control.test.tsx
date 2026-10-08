import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ResetSampleControl } from "./reset-sample-control";

afterEach(cleanup);

it("requires confirmation; cancel and Escape preserve the sample and restore focus", () => {
  const reset = vi.fn(async () => true);
  render(<ResetSampleControl reset={reset} busy={false} />);
  const trigger = screen.getByRole("button", { name: "Reset my sample" });
  fireEvent.click(trigger);
  expect(screen.getByRole("alertdialog", { name: "Reset your sample?" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Reset sample now" })).toHaveFocus();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(reset).not.toHaveBeenCalled(); expect(trigger).toHaveFocus();
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  fireEvent.click(trigger); fireEvent.keyDown(screen.getByRole("alertdialog"), { key: "Escape" });
  expect(reset).not.toHaveBeenCalled(); expect(trigger).toHaveFocus();
});

it("confirmed reset happens once and returns focus after success", async () => {
  let complete!: (success: boolean) => void;
  const reset = vi.fn(() => new Promise<boolean>(resolve => { complete = resolve; }));
  render(<ResetSampleControl reset={reset} busy={false} />);
  fireEvent.click(screen.getByRole("button", { name: "Reset my sample" }));
  fireEvent.click(screen.getByRole("button", { name: "Reset sample now" }));
  expect(screen.getByRole("button", { name: "Resetting sample…" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  complete(true);
  await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  expect(reset).toHaveBeenCalledOnce(); expect(screen.getByRole("button", { name: "Reset my sample" })).toHaveFocus();
});

it("failed reset keeps confirmation open with a retryable error", async () => {
  const reset = vi.fn(async () => false);
  render(<ResetSampleControl reset={reset} busy={false} />);
  fireEvent.click(screen.getByRole("button", { name: "Reset my sample" }));
  fireEvent.click(screen.getByRole("button", { name: "Reset sample now" }));
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Your current sample stays available"));
  expect(screen.getByRole("alertdialog")).toBeVisible();
  expect(screen.getByRole("button", { name: "Reset sample now" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
});
