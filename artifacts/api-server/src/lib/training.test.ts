import { describe, expect, it } from "vitest";
import { PAGE_GUIDES, TRAINING_MISSIONS, canCompleteTrainingStep, findTrainingStep } from "./training";

describe("training manifest", () => {
  it("covers every primary application page with contextual help", () => {
    expect(PAGE_GUIDES).toHaveLength(20);
    expect(PAGE_GUIDES.map((guide) => guide.key)).toEqual(expect.arrayContaining([
      "dashboard", "ai-operations", "leads", "pipeline", "estimator", "proposals", "jobs", "schedule", "calendar", "tasks",
      "materials", "inventory", "invoices", "commissions", "sales", "customers", "reports", "settings", "integration-health", "demo-outbox",
    ]));
  });

  it("defines five restartable missions with unique, allowlisted narration", () => {
    expect(TRAINING_MISSIONS.map((mission) => mission.key)).toEqual(["executive", "owner", "sales", "operations", "installer"]);
    const steps = TRAINING_MISSIONS.flatMap((mission) => mission.steps);
    expect(new Set(steps.map((step) => step.id)).size).toBe(steps.length);
    for (const step of steps) {
      expect(step.narration.length).toBeGreaterThan(50);
      expect(step.seconds).toBeGreaterThanOrEqual(20);
      expect(step.seconds).toBeLessThanOrEqual(40);
      expect(findTrainingStep(step.id)?.step.narration).toBe(step.narration);
    }
    expect(findTrainingStep("unregistered-user-speech")).toBeNull();
    expect(findTrainingStep("guide-dashboard")?.step.narration).toBe(PAGE_GUIDES[0].narration);
  });

  it("does not falsely complete an action checkpoint", () => {
    expect(canCompleteTrainingStep({ kind: "action" }, false)).toBe(false);
    expect(canCompleteTrainingStep({ kind: "action" }, true)).toBe(true);
    expect(canCompleteTrainingStep({ kind: "action" }, false, true)).toBe(true);
    expect(canCompleteTrainingStep({ kind: "info" }, false)).toBe(true);
  });
});
