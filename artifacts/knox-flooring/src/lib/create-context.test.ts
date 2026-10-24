import { describe, expect, it } from "vitest";
import { contextualCreateHref, createContextRefs, estimateContextDefaults, resolveCreateContext } from "./create-context";
import type { Job, Lead } from "./types";
import type { EstimateInput } from "@workspace/domain";

const job = { id: "job/one", customerId: "customer-1", siteId: "site-1", jobNumber: "J-1", customerName: "Same Name", phone: "5550100", email: "one@example.test", address: "1 Test Street", city: "Farragut", flooringType: "Hardwood", rooms: [{ id: "room-1", name: "Kitchen", length: 10, width: 12 }] } as Job;
const lead = { id: "lead-1", customerId: "customer-2", siteId: "site-2", customerName: "Same Name", phone: "5550200", email: "two@example.test", address: "2 Test Street", city: "Knoxville", flooringInterest: "Tile" } as Lead;
const data = { jobs: [job], leads: [lead] };

describe("Create context", () => {
  it("carries only encoded record IDs, without filters, contact details or an existing draft", () => {
    const refs = createContextRefs("/jobs/job%2Fone", "q=private&draft=old&leadId=unrelated");
    expect(refs).toEqual({ jobId: "job/one" });
    expect(contextualCreateHref("/invoices?create=1", refs)).toBe("/invoices?create=1&jobId=job%2Fone");
  });
  it("resolves job and lead customer/site identities and their appropriate project defaults", () => {
    expect(resolveCreateContext({ jobId: job.id }, data)).toMatchObject({ customerId: "customer-1", siteId: "site-1", customerName: "Same Name", flooringType: "Hardwood", jobId: job.id });
    expect(resolveCreateContext({ leadId: lead.id }, data)).toMatchObject({ customerId: "customer-2", siteId: "site-2", leadId: lead.id, flooringType: "Tile" });
  });
  it("never chooses between same-name customers from a legacy URL", () => {
    expect(resolveCreateContext({ customerId: "same name" }, data).found).toBe(false);
    expect(resolveCreateContext({ customerId: "customer-1" }, data).customerJobs).toEqual([job]);
  });
  it("uses the selected customer's sole site, but does not guess among multiple sites", () => {
    const customer = { id: "c1", name: "Customer", phone: "", email: "", notes: "", revision: 1 };
    const site = { id: "s1", customerId: "c1", label: "Home", address: "10 Example Road", city: "Maryville", state: "TN", zip: "37801" };
    expect(resolveCreateContext({ customerId: "c1" }, { ...data, customers: [customer], sites: [site] })).toMatchObject({ customerId: "c1", siteId: "s1", address: site.address });
    expect(resolveCreateContext({ customerId: "c1" }, { ...data, customers: [customer], sites: [site, { ...site, id: "s2" }] }).siteId).toBeUndefined();
  });
  it("keeps existing estimate policy values while applying customer, site and measured rooms", () => {
    const initial = { customerName: "", city: "Knoxville", flooringType: "Hardwood", rooms: [], wastePercent: 12, laborRate: 4, targetMarginPercent: 30, lines: [], allowances: [], notes: "", policyVersion: 1 } as EstimateInput;
    expect(estimateContextDefaults(initial, resolveCreateContext({ jobId: job.id }, data))).toMatchObject({ customerId: "customer-1", siteId: "site-1", rooms: job.rooms, laborRate: 4, wastePercent: 12 });
  });
});
