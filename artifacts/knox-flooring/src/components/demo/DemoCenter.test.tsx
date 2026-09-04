import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DemoCenter } from "./DemoCenter";
import type { TrainingStatus } from "./training-types";

const mocks = vi.hoisted(() => ({ api: vi.fn(), navigate: vi.fn(), switchPersona: vi.fn(), user: { role: "owner" as const, actualRole: "owner" as "owner" | undefined, previewRole: null as null | "sales" } }));
vi.mock("@workspace/api-client-react", () => ({ customFetch: mocks.api }));
vi.mock("wouter", () => ({ useLocation: () => ["/", mocks.navigate] }));
vi.mock("@/contexts/auth", () => ({ useAuth: () => ({ user: mocks.user, switchPersona: mocks.switchPersona }) }));

const preferences = { userId: "owner", voiceEnabled: false, captionsEnabled: true as const, welcomeDismissed: true };
const mission = {
  key: "executive", name: "Executive Tour", role: "owner" as const, minutes: 15, summary: "Lead to payment",
  steps: [{ id: "executive-dashboard", route: "/", target: "nav-dashboard", placement: "right" as const, kind: "info" as const, title: "Your command center", explanation: "Owner priorities", instruction: "Review this control", narration: "Welcome to the command center for this flooring business and its daily priorities.", seconds: 25 }],
};

function status(kind: "info" | "action" = "info"): TrainingStatus {
  return {
    enabled: true, manifestVersion: "test", preferences, runs: [], pageGuides: [{ key: "dashboard", name: "Dashboard", route: "/", role: ["owner"], summary: "Daily priorities", target: "nav-dashboard", narration: "Dashboard help" }],
    missions: [{ ...mission, steps: [{ ...mission.steps[0], kind }] }],
  };
}

function installApi(kind: "info" | "action" = "info") {
  mocks.api.mockImplementation((path: string, options?: RequestInit) => {
    if (path === "/api/demo/status") return Promise.resolve(status(kind));
    if (path.endsWith("/start")) return Promise.resolve({ id: "run-1", userId: "owner", missionKey: "executive", manifestVersion: "test", status: "active", currentStep: 0, voiceEnabled: false, checkpoints: [], startedAt: "now", updatedAt: "now" });
    if (path.endsWith("/verify")) return Promise.resolve({ id: "run-1", userId: "owner", missionKey: "executive", manifestVersion: "test", status: "completed", currentStep: 0, voiceEnabled: false, checkpoints: ["executive-dashboard"], startedAt: "now", updatedAt: "now", complete: true });
    if (path === "/api/demo/preferences" && options?.method === "PUT") return Promise.resolve(preferences);
    throw new Error(`Unexpected request: ${path}`);
  });
}

describe("DemoCenter", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.user.actualRole = "owner"; mocks.user.previewRole = null; });
  afterEach(() => cleanup());

  it("opens from the persistent Training control and completes an informational step", async () => {
    installApi();
    render(<><button data-training-id="nav-dashboard">Dashboard</button><DemoCenter /></>);
    await waitFor(() => expect(mocks.api).toHaveBeenCalledWith("/api/demo/status", expect.anything()));
    fireEvent(window, new Event("knox:demo-center"));
    expect(await screen.findByText("Training Center")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /start silently/i }));
    expect(await screen.findByText("Your command center")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /complete mission/i }));
    await waitFor(() => expect(mocks.api).toHaveBeenCalledWith(expect.stringMatching(/verify$/), expect.objectContaining({ method: "POST" })));
    expect(await screen.findByText("Training Center")).toBeInTheDocument();
  });

  it("requires interaction with an action target before verification", async () => {
    installApi("action");
    render(<><button data-training-id="nav-dashboard">Dashboard target</button><DemoCenter /></>);
    await waitFor(() => expect(mocks.api).toHaveBeenCalled());
    fireEvent(window, new Event("knox:demo-center"));
    fireEvent.click(await screen.findByRole("button", { name: /start silently/i }));
    expect(await screen.findByText("Your command center")).toBeInTheDocument();
    const verify = await screen.findByRole("button", { name: /verify & complete/i });
    expect(verify).toBeDisabled();
    fireEvent.click(screen.getByText("Dashboard target"));
    expect(verify).toBeEnabled();
  });

  it("captures pointer interaction before an action control can re-render", async () => {
    installApi("action");
    render(<><button data-training-id="nav-dashboard">Generate AI recommendations</button><DemoCenter /></>);
    await waitFor(() => expect(mocks.api).toHaveBeenCalled());
    fireEvent(window, new Event("knox:demo-center"));
    fireEvent.click(await screen.findByRole("button", { name: /start silently/i }));
    const target = await screen.findByRole("button", { name: "Generate AI recommendations" });
    fireEvent.pointerDown(target);
    expect(await screen.findByText(/highlighted control used/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /verify & complete/i })).toBeEnabled();
  });

  it("keeps a contextual Page Guide available outside missions", async () => {
    installApi();
    render(<><button data-training-id="nav-dashboard">Dashboard</button><DemoCenter /></>);
    fireEvent.click(await screen.findByRole("button", { name: /open dashboard page guide/i }));
    expect(await screen.findByText("Dashboard Page Guide")).toBeInTheDocument();
    expect(screen.getByText("Daily priorities")).toBeInTheDocument();
  });

  it("switches a password-free owner session into the sales perspective before starting sales training", async () => {
    mocks.user.actualRole = undefined;
    const salesMission = { ...mission, key: "sales", name: "Sales & Estimating Mission", role: "sales" as const };
    mocks.api.mockImplementation((path: string) => {
      if (path === "/api/demo/status") return Promise.resolve({ ...status(), missions: [salesMission] });
      if (path.endsWith("/start")) return Promise.resolve({ id: "run-sales", userId: "owner", missionKey: "sales", manifestVersion: "test", status: "active", currentStep: 0, voiceEnabled: false, checkpoints: [], startedAt: "now", updatedAt: "now" });
      throw new Error(`Unexpected request: ${path}`);
    });
    render(<><button data-training-id="nav-dashboard">Dashboard</button><DemoCenter /></>);
    fireEvent(window, new Event("knox:demo-center"));
    fireEvent.click(await screen.findByRole("button", { name: /start silently/i }));
    await waitFor(() => expect(mocks.switchPersona).toHaveBeenCalledWith("sales"));
    await waitFor(() => expect(mocks.api).toHaveBeenCalledWith("/api/demo/missions/sales/start", expect.objectContaining({ method: "POST" })));
  });
});
