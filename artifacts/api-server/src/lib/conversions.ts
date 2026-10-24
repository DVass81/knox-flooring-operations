import { randomBytes, randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import {
  jobsTable,
  leadsTable,
  proposalsTable,
  invoicesTable,
  jobMaterialsTable,
  materialsTable,
  measurementsTable,
  salespeopleTable,
  quickbooksSyncJobsTable,
  type JobInsert,
  type JobRow,
  type ProposalRow,
} from "@workspace/db";
import type { EstimateSnapshot } from "@workspace/domain";
import { ensureCustomer, type Transaction } from "./estimate-service";
import { assertRevision, DomainError } from "./operations-rules";

export async function nextDocumentNumber(
  tx: Transaction,
  kind: "job" | "invoice",
) {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext(${"document-number:" + kind}))`,
  );
  const numbers =
    kind === "job"
      ? await tx.select({ number: jobsTable.jobNumber }).from(jobsTable)
      : await tx
          .select({ number: invoicesTable.invoiceNumber })
          .from(invoicesTable);
  return `${kind === "job" ? "J" : "INV"}-${Math.max(1000, ...numbers.map((r) => Number.parseInt(r.number.replace(/\D/g, ""), 10)).filter(Number.isFinite)) + 1}`;
}
async function queueReview(
  tx: Transaction,
  entityType: string,
  localId: string,
  payload: Record<string, unknown>,
) {
  const now = new Date().toISOString();
  await tx
    .insert(quickbooksSyncJobsTable)
    .values({
      id: randomUUID(),
      idempotencyKey: `conversion:${entityType}:${localId}`,
      entityType,
      localId,
      action: "create",
      status: "pending_approval",
      payload,
      warnings: [
        "Review customer, pricing and accounting mappings before approval",
      ],
      nextAttemptAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();
}
export async function insertSnapshotJob(
  tx: Transaction,
  snapshot: EstimateSnapshot,
  extra: Partial<JobInsert> = {},
) {
  if (!snapshot.valid)
    throw new DomainError(400, "Complete the estimate before converting it.", {
      issues: snapshot.issues,
    });
  const now = new Date().toISOString();
  const input = snapshot.inputs;
  const [job] = await tx
    .insert(jobsTable)
    .values({
      id: randomUUID(),
      jobNumber: await nextDocumentNumber(tx, "job"),
      customerName: input.customerName,
      customerId: input.customerId,
      siteId: input.siteId,
      city: input.city,
      flooringType: input.flooringType,
      rooms: input.rooms,
      squareFootage: snapshot.rawSqFt,
      scopeOfWork: snapshot.summary,
      crewAssigned: "Unassigned",
      materialStatus: "Not Ordered",
      laborEstimate: snapshot.laborCost,
      estLaborHours: snapshot.estimatedLaborHours ?? 0,
      materialEstimate: snapshot.materialCost + snapshot.additionalCost,
      estRevenue: snapshot.sellingPrice,
      estGrossProfit: snapshot.grossProfit,
      grossMarginPct: snapshot.marginPercent,
      notes: input.notes,
      priorityLevel: "Medium",
      riskLevel: "Low",
      status: "Estimate Completed",
      stageHistory: [{ stage: "Estimate Completed", at: now }],
      estimateSnapshot: snapshot as unknown as Record<string, unknown>,
      shareToken: randomBytes(12).toString("hex"),
      createdAt: now,
      updatedAt: now,
      ...extra,
    })
    .returning();
  if (snapshot.lines.length)
    await tx.insert(jobMaterialsTable).values(
      snapshot.lines.map((line) => ({
        id: randomUUID(),
        jobId: job.id,
        productId: line.productId,
        name: line.name,
        quantity: line.quantity ?? 0,
        unit: line.unit,
        createdAt: now,
      })),
    );
  await queueReview(tx, "customer", job.id, job);
  await queueReview(tx, "project", job.id, job);
  return job;
}
export async function convertLead(
  tx: Transaction,
  leadId: string,
  expected?: number,
) {
  const [lead] = await tx
    .select()
    .from(leadsTable)
    .where(eq(leadsTable.id, leadId))
    .for("update");
  if (!lead) throw new DomainError(404, "Lead not found");
  if (lead.convertedJobId) {
    const [job] = await tx
      .select()
      .from(jobsTable)
      .where(eq(jobsTable.id, lead.convertedJobId));
    if (!job)
      throw new DomainError(
        409,
        "The converted job is missing. Resolve the link before converting again.",
      );
    return job;
  }
  assertRevision(lead.revision, expected);
  const now = new Date().toISOString();
  const customerId = await ensureCustomer(tx, lead);
  const reps = await tx.select().from(salespeopleTable);
  const matched = reps.filter((r) => r.name === lead.salesperson);
  const measurements = await tx
    .select()
    .from(measurementsTable)
    .where(eq(measurementsTable.leadId, lead.id));
  const measurement = measurements.length === 1 ? measurements[0] : undefined;
  const [job] = await tx
    .insert(jobsTable)
    .values({
      id: randomUUID(),
      jobNumber: await nextDocumentNumber(tx, "job"),
      customerName: lead.customerName,
      customerId,
      siteId: lead.siteId,
      phone: lead.phone,
      email: lead.email,
      address: lead.address || lead.street,
      city: lead.city,
      flooringType: lead.flooringInterest,
      squareFootage: measurement?.totalSqft || lead.estimatedSqft,
      rooms:
        measurement?.rooms
          .filter((r) => r.lengthFt && r.widthFt)
          .map((r) => ({
            id: randomUUID(),
            name: r.name,
            length: r.lengthFt!,
            width: r.widthFt!,
          })) ?? [],
      scopeOfWork: lead.desiredServices,
      salespersonId: matched.length === 1 ? matched[0].id : null,
      estRevenue: lead.estimatedValue,
      materialStatus: "Not Ordered",
      crewAssigned: "Unassigned",
      priorityLevel: "Medium",
      riskLevel: "Low",
      status: "Approved",
      soldAt: now,
      eventDateSource: "lead_conversion",
      notes: `Converted from lead. Costs require an approved estimate.\n${lead.notes}`,
      stageHistory: [{ stage: "Approved", at: now }],
      shareToken: randomBytes(12).toString("hex"),
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  await tx
    .update(leadsTable)
    .set({
      customerId,
      stage: "Won",
      convertedJobId: job.id,
      revision: lead.revision + 1,
      updatedAt: now,
      activityLog: [
        ...lead.activityLog,
        {
          id: randomUUID(),
          date: now,
          type: "Stage Change",
          note: `Lead won and converted to job ${job.jobNumber}.`,
        },
      ],
    })
    .where(eq(leadsTable.id, lead.id));
  for (const m of measurements)
    if (!m.jobId)
      await tx
        .update(measurementsTable)
        .set({ jobId: job.id })
        .where(eq(measurementsTable.id, m.id));
  await queueReview(tx, "customer", job.id, job);
  await queueReview(tx, "project", job.id, job);
  return job;
}
export async function convertProposal(tx: Transaction, proposalId: string) {
  const [proposal] = await tx
    .select()
    .from(proposalsTable)
    .where(eq(proposalsTable.id, proposalId))
    .for("update");
  if (!proposal) throw new DomainError(404, "Proposal not found");
  if (proposal.convertedJobId || proposal.convertedInvoiceId) {
    const [job] = proposal.convertedJobId
      ? await tx
          .select()
          .from(jobsTable)
          .where(eq(jobsTable.id, proposal.convertedJobId))
      : [];
    const [invoice] = proposal.convertedInvoiceId
      ? await tx
          .select()
          .from(invoicesTable)
          .where(eq(invoicesTable.id, proposal.convertedInvoiceId))
      : [];
    if (!job || !invoice)
      throw new DomainError(
        409,
        "This quote has an incomplete historical conversion. Resolve its existing links before retrying.",
      );
    const materials = await tx
      .select()
      .from(jobMaterialsTable)
      .where(eq(jobMaterialsTable.jobId, job.id));
    return { job, invoice, materialsCreated: materials.length };
  }
  if (proposal.status !== "Accepted")
    throw new DomainError(
      400,
      "Only accepted quotes can be converted to a job.",
    );
  const now = new Date().toISOString();
  const customerId = await ensureCustomer(tx, proposal);
  const snapshot =
    proposal.estimateSnapshot as unknown as EstimateSnapshot | null;
  const extra: Partial<JobInsert> = {
    customerName: proposal.customerName,
    customerId,
    siteId: proposal.siteId,
    salespersonId: proposal.salespersonId,
    status: "Approved",
    soldAt: proposal.acceptedAt ?? null,
    eventDateSource: proposal.acceptedAt ? "accepted_quote" : null,
    stageHistory: proposal.acceptedAt
      ? [{ stage: "Approved", at: proposal.acceptedAt }]
      : [],
    notes: `Created from accepted quote. ${snapshot ? "" : "Historical quote has no cost snapshot; review costs before relying on margin."}`,
    estRevenue: proposal.estimatedPrice,
  };
  let job: JobRow;
  if (snapshot) job = await insertSnapshotJob(tx, snapshot, extra);
  else {
    [job] = await tx
      .insert(jobsTable)
      .values({
        id: randomUUID(),
        jobNumber: await nextDocumentNumber(tx, "job"),
        customerName: proposal.customerName,
        city: proposal.projectLocation,
        flooringType: proposal.flooringType,
        rooms: proposal.roomList,
        squareFootage: proposal.totalSqFt,
        scopeOfWork: proposal.scopeOfWork,
        crewAssigned: "Unassigned",
        materialStatus: "Not Ordered",
        priorityLevel: "Medium",
        riskLevel: "Low",
        status: "Approved",
        shareToken: randomBytes(12).toString("hex"),
        createdAt: now,
        updatedAt: now,
        ...extra,
      })
      .returning();
    if (proposal.lineItems.length)
      await tx.insert(jobMaterialsTable).values(
        proposal.lineItems.map((line) => ({
          id: randomUUID(),
          jobId: job.id,
          productId: line.productId,
          name: line.name,
          quantity: line.quantity,
          unit: line.unit,
          createdAt: now,
        })),
      );
    await queueReview(tx, "customer", job.id, job);
    await queueReview(tx, "project", job.id, job);
  }
  await tx.insert(materialsTable).values({
    id: randomUUID(),
    jobId: job.id,
    jobNumber: job.jobNumber,
    customer: job.customerName,
    city: job.city,
    flooringType: job.flooringType,
    received: false,
    damaged: false,
    notes:
      "Material requirements from accepted quote; ordering is not yet recorded.",
    status: "Not Ordered",
  });
  // Deposit terms request a payment; conversion is not evidence of receiving one.
  const [invoice] = await tx
    .insert(invoicesTable)
    .values({
      id: randomUUID(),
      invoiceNumber: await nextDocumentNumber(tx, "invoice"),
      jobId: job.id,
      customerId: job.customerId,
      jobNumber: job.jobNumber,
      customerName: proposal.customerName,
      lineItems: [
        {
          id: randomUUID(),
          description:
            proposal.scopeOfWork || `${proposal.flooringType} installation`,
          category: "Materials",
          quantity: 1,
          unitPrice: proposal.estimatedPrice,
        },
      ],
      subtotal: proposal.estimatedPrice,
      taxableAmount: proposal.estimatedPrice,
      total: proposal.estimatedPrice,
      depositAmount: 0,
      balanceAmount: proposal.estimatedPrice,
      status: "Draft",
      issueDate: now.slice(0, 10),
      dueDate: "",
      notes: [
        proposal.paymentTerms,
        proposal.depositType === "none"
          ? ""
          : `Deposit requested: ${proposal.depositType === "percent" ? proposal.depositValue + "%" : "$" + proposal.depositValue}. Payment has not been recorded.`,
      ]
        .filter(Boolean)
        .join("\n"),
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  await tx
    .update(proposalsTable)
    .set({
      customerId,
      jobId: job.id,
      convertedJobId: job.id,
      convertedInvoiceId: invoice.id,
      revision: proposal.revision + 1,
    })
    .where(eq(proposalsTable.id, proposal.id));
  await queueReview(tx, "invoice", invoice.id, invoice);
  return {
    job,
    invoice,
    materialsCreated: snapshot?.lines.length ?? proposal.lineItems.length,
  };
}
