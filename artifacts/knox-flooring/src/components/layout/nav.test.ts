import { describe, expect, it } from "vitest";
import { canAccess, createItems, isNavActive, navGroups, navItems } from "./nav";

describe("workspace navigation", () => {
  it("keeps every existing page discoverable while limiting the primary owner navigation", () => {
    const primary = navGroups.flatMap((group) => group.items).filter((item) => canAccess(item, "owner"));
    expect(primary).toHaveLength(12);
    for (const route of ["/pipeline", "/schedule", "/calendar", "/tasks", "/commissions", "/sales", "/integration-health", "/demo-outbox"]) expect(navItems.some((item) => item.href === route)).toBe(true);
    expect(isNavActive(primary.find((item) => item.href === "/jobs")!, "/pipeline")).toBe(true);
    expect(isNavActive(primary.find((item) => item.href === "/reports")!, "/commissions")).toBe(true);
  });
  it("does not send sales or installers into owner-only finance or crew configuration", () => {
    for (const role of ["sales", "installer"]) {
      const allowed = navItems.filter((item) => canAccess(item, role)).map((item) => item.href);
      expect(allowed).toContain("/tasks");
      expect(allowed).not.toContain("/calendar");
      expect(allowed).not.toContain("/schedule");
      expect(allowed).not.toContain("/invoices");
      expect(allowed).not.toContain("/settings");
    }
    expect(createItems.filter((item) => canAccess(item, "installer")).map((item) => item.href)).toEqual(["/tasks?create=1"]);
  });
});
