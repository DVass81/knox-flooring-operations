import { describe, expect, it } from "vitest";
import { aggregateCustomers, customerKey, resolveCustomerCandidates } from "./customers";
import type { Job, Invoice, Proposal } from "./types";
import type { Customer } from "./operations";

const job = (id: string, customerId?: string) => ({ id, customerId, customerName: "Alex Smith", phone: "", email: "", city: "Knoxville", jobNumber: id, createdAt: "2020-01-01", updatedAt: "2020-01-02" }) as Job;
const profile = (id: string, name = "Alex Smith") => ({ id, name, email: "", phone: "", notes: "", revision: 1 }) as Customer;

describe("customer identity and preserved history", () => {
  it("keeps same-name customers separate and asks legacy links to choose", () => {
    const records = aggregateCustomers([job("J1", "one"), job("J2", "two")], [], [], [profile("one"), profile("two")]);
    expect(records).toHaveLength(2);
    expect(resolveCustomerCandidates(records, customerKey("Alex Smith"))).toHaveLength(2);
    expect(resolveCustomerCandidates(records, "one").map(record => record.id)).toEqual(["one"]);
  });
  it("connects legacy documents only through explicit job links", () => {
    const proposals = [{ id: "P1", customerName: "Alex Smith", jobId: "J1", convertedJobId: null }, { id: "P2", customerName: "Alex Smith", jobId: "J1", convertedJobId: "J2" }] as Proposal[];
    const invoice = { id: "I1", jobId: "J1", customerName: "Alex Smith", status: "Paid", total: 903.45 } as Invoice;
    const records = aggregateCustomers([job("J1"), job("J2")], proposals, [invoice]);
    expect(records).toHaveLength(3);
    const linked = records.find(record => record.id === "legacy:job:J1")!;
    expect(linked.proposals.map(proposal => proposal.id)).toEqual(["P1"]);
    expect(linked.invoices[0]).toBe(invoice);
    expect(linked.lifetimeValue).toBe(903.45);
    expect(records.find(record => record.id === "legacy:proposal:P2")?.jobs).toHaveLength(0);
  });
  it("retains recipient snapshots and balances when a customer is renamed or merged", () => {
    const invoice = { id: "I1", jobId: "J1", customerId: "canonical", customerName: "Former name", status: "Partial", total: 900, paidAmount: 300, balanceAmount: 600 } as Invoice;
    const records = aggregateCustomers([job("J1", "canonical"), job("J2", "canonical")], [], [invoice], [profile("canonical", "Current name")]);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ name: "Current name", isRepeat: true, outstanding: 600, lifetimeValue: 0 });
    expect(records[0].invoices[0].customerName).toBe("Former name");
    expect(resolveCustomerCandidates(records, customerKey("Former name"))[0].id).toBe("canonical");
  });
  it("shows newly created customers before they have project history", () => {
    const records = aggregateCustomers([], [], [], [profile("new-customer")]);
    expect(records[0]).toMatchObject({ id: "new-customer", jobs: [], invoices: [], lifetimeValue: 0, outstanding: 0 });
  });
  it("does not restore old contact details after the profile contact is cleared", () => {
    const historical = { ...job("J1", "one"), phone: "Old phone", email: "old@example.test" };
    const [record] = aggregateCustomers([historical], [], [], [profile("one")]);
    expect(record.phone).toBe(""); expect(record.email).toBe("");
    expect(record.jobs[0].phone).toBe("Old phone");
  });
});
