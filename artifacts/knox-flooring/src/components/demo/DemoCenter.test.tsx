import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DemoCenter } from "./DemoCenter";
import type { TrainingStatus } from "./training-types";
import { Button } from "@/components/ui/button";

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
    narration: { provider: "ElevenLabs", voice: "Adam - Engaging, Friendly and Bright", model: "eleven_multilingual_v2" },
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

function installAudio(fetchMock: ReturnType<typeof vi.fn>) {
  const play = vi.fn(() => Promise.resolve());
  const pause = vi.fn();
  const audio = vi.fn(function (this: { play: typeof play; pause: typeof pause }) { this.play = play; this.pause = pause; });
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("Audio", audio);
  vi.stubGlobal("URL", class extends URL {
    static createObjectURL = vi.fn(() => "blob:training-audio");
    static revokeObjectURL = vi.fn();
  });
  return { audio, play, pause };
}

function narrationResponse(provider = "ElevenLabs", fallback = false) {
  return new Response(new Uint8Array([1, 2, 3]), { headers: {
    "Content-Type": "audio/mpeg",
    "X-Narration-Provider": provider,
    "X-Narration-Voice": provider === "ElevenLabs" ? "Selected teaching voice" : "marin",
    ...(fallback ? { "X-Narration-Fallback-Reason": "ElevenLabs is busy. Playing the backup voice; Replay tries ElevenLabs again." } : {}),
  } });
}

describe("DemoCenter", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.user.actualRole = "owner"; mocks.user.previewRole = null; });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

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

  it("accepts the registered interaction emitted by trained action buttons", async () => {
    installApi("action");
    render(<><Button data-training-id="nav-dashboard">Generate AI recommendations</Button><DemoCenter /></>);
    await waitFor(() => expect(mocks.api).toHaveBeenCalled());
    fireEvent(window, new Event("knox:demo-center"));
    fireEvent.click(await screen.findByRole("button", { name: /start silently/i }));
    fireEvent.click(await screen.findByRole("button", { name: "Generate AI recommendations" }));
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

  it("retries the selected provider after backup narration without reusing a browser-cached fallback", async () => {
    installApi();
    const fetchMock = vi.fn().mockResolvedValueOnce(narrationResponse("OpenAI", true)).mockResolvedValueOnce(narrationResponse());
    const audio = installAudio(fetchMock);
    render(<><button data-training-id="nav-dashboard">Dashboard</button><DemoCenter /></>);
    await waitFor(() => expect(mocks.api).toHaveBeenCalled());
    fireEvent(window, new Event("knox:demo-center"));
    fireEvent.click(await screen.findByRole("button", { name: /start with voice/i }));
    expect(await screen.findByRole("status")).toHaveTextContent("ElevenLabs is busy. Playing the backup voice; Replay tries ElevenLabs again.");
    await waitFor(() => expect(audio.play).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "Replay" }));
    expect(await screen.findByText(/ElevenLabs · Selected teaching voice/)).toBeInTheDocument();
    await waitFor(() => expect(audio.play).toHaveBeenCalledTimes(2));
    expect(screen.queryByText(/Playing the backup voice/i)).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const [, options] of fetchMock.mock.calls) expect(options).toMatchObject({ cache: "no-store", credentials: "include", signal: expect.any(AbortSignal) });
  });

  it("cancels pending narration when muted and ignores a late response", async () => {
    installApi();
    let resolveAudio!: (response: Response) => void;
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => { resolveAudio = resolve; }));
    const audio = installAudio(fetchMock);
    render(<><button data-training-id="nav-dashboard">Dashboard</button><DemoCenter /></>);
    await waitFor(() => expect(mocks.api).toHaveBeenCalled());
    fireEvent(window, new Event("knox:demo-center"));
    fireEvent.click(await screen.findByRole("button", { name: /start with voice/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const request = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    fireEvent.click(screen.getByRole("button", { name: "Mute narration" }));
    expect(request[1].signal?.aborted).toBe(true);
    await act(async () => { resolveAudio(narrationResponse("OpenAI", true)); });
    expect(audio.audio).not.toHaveBeenCalled();
    expect(screen.queryByText(/OpenAI backup narrator/)).not.toBeInTheDocument();
    expect(screen.queryByText(/temporarily unavailable/i)).not.toBeInTheDocument();
  });

  it("ignores narration from an old step and aborts its prefetch after advancing", async () => {
    const secondStep = { ...mission.steps[0], id: "executive-second", title: "Next lesson" };
    const training = status();
    training.missions[0].steps.push(secondStep);
    const run = { id: "run-1", userId: "owner", missionKey: "executive", manifestVersion: "test", status: "active", currentStep: 0, voiceEnabled: true, checkpoints: [], startedAt: "now", updatedAt: "now" };
    mocks.api.mockImplementation((path: string) => {
      if (path === "/api/demo/status") return Promise.resolve(training);
      if (path.endsWith("/start")) return Promise.resolve(run);
      if (path.endsWith("/verify")) return Promise.resolve({ ...run, currentStep: 1 });
      throw new Error(`Unexpected request: ${path}`);
    });
    const requests: Array<{ url: string; options: RequestInit; resolve: (response: Response) => void }> = [];
    const fetchMock = vi.fn((url: string, options: RequestInit) => new Promise<Response>((resolve) => { requests.push({ url, options, resolve }); }));
    const audio = installAudio(fetchMock);
    render(<><button data-training-id="nav-dashboard">Dashboard</button><DemoCenter /></>);
    await waitFor(() => expect(mocks.api).toHaveBeenCalled());
    fireEvent(window, new Event("knox:demo-center"));
    fireEvent.click(await screen.findByRole("button", { name: /start with voice/i }));
    await waitFor(() => expect(requests).toHaveLength(2));
    expect(requests[1].url).toContain(secondStep.id);
    expect(requests[1].options.cache).toBe("no-store");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Next lesson")).toBeInTheDocument();
    await waitFor(() => expect(requests).toHaveLength(3));
    expect(requests[0].options.signal?.aborted).toBe(true);
    expect(requests[1].options.signal?.aborted).toBe(true);
    await act(async () => { requests[2].resolve(narrationResponse()); });
    await waitFor(() => expect(audio.play).toHaveBeenCalledTimes(1));
    await act(async () => { requests[0].resolve(narrationResponse("OpenAI", true)); requests[1].resolve(narrationResponse()); });
    expect(audio.play).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/ElevenLabs · Selected teaching voice/)).toBeInTheDocument();
    expect(screen.queryByText(/Playing the backup voice/i)).not.toBeInTheDocument();
  });
});
