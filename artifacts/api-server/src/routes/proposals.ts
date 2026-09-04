import { Router, type IRouter } from "express";
import { randomBytes, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  db,
  proposalsTable,
  jobsTable,
  jobMaterialsTable,
  materialsTable,
  invoicesTable,
  type ProposalInsert,
  type JobInsert,
  type JobMaterialInsert,
  type MaterialInsert,
  type InvoiceInsert,
  type InvoiceLineItem,
} from "@workspace/db";
import {
  ListProposalsResponse,
  CreateProposalBody,
  UpdateProposalParams,
  UpdateProposalBody,
  UpdateProposalResponse,
  ConvertProposalParams,
  ConvertProposalResponse,
} from "@workspace/api-zod";
import { stripNulls } from "../lib/strip-nulls";
import { queueQuickBooksReview } from "../lib/quickbooks-queue";

const router: IRouter = Router();

function generateShareToken(): string {
  return randomBytes(12).toString("hex");
}

function nextNumber(existing: string[], prefix: string): string {
  const nums = existing
    .map((n) => parseInt(n.replace(/\D/g, ""), 10))
    .filter((n) => !Number.isNaN(n));
  const max = nums.length ? Math.max(...nums) : 1000;
  return `${prefix}-${max + 1}`;
}

/** Resolve the dollar deposit for a proposal from its deposit terms. */
export function depositAmountFor(proposal: {
  depositType: string;
  depositValue: number;
  estimatedPrice: number;
}): number {
  if (proposal.depositType === "percent") {
    return Math.round(((proposal.estimatedPrice || 0) * (proposal.depositValue || 0)) / 100);
  }
  if (proposal.depositType === "amount") {
    return proposal.depositValue || 0;
  }
  return 0;
}

router.get("/proposals", async (_req, res): Promise<void> => {
  const proposals = await db.select().from(proposalsTable);
  res.json(ListProposalsResponse.parse(proposals.map(stripNulls)));
});

router.post("/proposals", async (req, res): Promise<void> => {
  const parsed = CreateProposalBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid proposal body");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const now = new Date().toISOString();
  const values: ProposalInsert = {
    ...parsed.data,
    id: randomUUID(),
    shareToken: generateShareToken(),
    sentAt: parsed.data.status === "Sent" ? now : null,
    createdAt: now,
  };

  const [proposal] = await db.insert(proposalsTable).values(values).returning();
  await queueQuickBooksReview("estimate", proposal.id, "create", stripNulls(proposal), ["Customer must be reconciled before this estimate is approved"]);
  res.status(201).json(UpdateProposalResponse.parse(stripNulls(proposal)));
});

router.patch("/proposals/:id", async (req, res): Promise<void> => {
  const params = UpdateProposalParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateProposalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [current] = await db
    .select()
    .from(proposalsTable)
    .where(eq(proposalsTable.id, params.data.id));

  if (!current) {
    res.status(404).json({ error: "Proposal not found" });
    return;
  }

  const now = new Date().toISOString();
  const updates: Partial<ProposalInsert> = { ...parsed.data };

  if (parsed.data.status && parsed.data.status !== current.status) {
    switch (parsed.data.status) {
      case "Sent":
        if (!current.shareToken) updates.shareToken = generateShareToken();
        if (!current.sentAt) updates.sentAt = now;
        break;
      case "Viewed":
        if (!current.viewedAt) updates.viewedAt = now;
        break;
      case "Accepted":
        updates.acceptedAt = now;
        break;
      case "Declined":
        updates.declinedAt = now;
        break;
    }
  }

  const [proposal] = await db
    .update(proposalsTable)
    .set(updates)
    .where(eq(proposalsTable.id, params.data.id))
    .returning();

  await queueQuickBooksReview("estimate", proposal.id, "update", stripNulls(proposal), ["Customer must be reconciled before this estimate is approved"]);

  res.json(UpdateProposalResponse.parse(stripNulls(proposal)));
});

router.post("/proposals/:id/convert", async (req, res): Promise<void> => {
  const params = ConvertProposalParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [proposal] = await db
    .select()
    .from(proposalsTable)
    .where(eq(proposalsTable.id, params.data.id));

  if (!proposal) {
    res.status(404).json({ error: "Proposal not found" });
    return;
  }
  await queueQuickBooksReview("estimate", proposal.id, "update", stripNulls(proposal), ["Customer must be reconciled before this estimate is approved"]);

  // Idempotent: if already converted, return the existing job + invoice instead
  // of creating duplicates. This is the duplicate-conversion guard.
  if (proposal.convertedJobId && proposal.convertedInvoiceId) {
    const [job] = await db
      .select()
      .from(jobsTable)
      .where(eq(jobsTable.id, proposal.convertedJobId));
    const [invoice] = await db
      .select()
      .from(invoicesTable)
      .where(eq(invoicesTable.id, proposal.convertedInvoiceId));
    if (job && invoice) {
      const existingMaterials = await db
        .select({ id: jobMaterialsTable.id })
        .from(jobMaterialsTable)
        .where(eq(jobMaterialsTable.jobId, job.id));
      res.json(
        ConvertProposalResponse.parse({
          job: stripNulls(job),
          invoice: stripNulls(invoice),
          materialsCreated: existingMaterials.length,
        }),
      );
      return;
    }
  }

  if (proposal.status !== "Accepted") {
    res
      .status(400)
      .json({ error: "Only accepted quotes can be converted to a job." });
    return;
  }

  const now = new Date().toISOString();
  const lineItems = proposal.lineItems ?? [];

  // Sum catalog line items as the material estimate for the job.
  const materialEstimate = lineItems.reduce(
    (sum, li) => sum + (li.quantity || 0) * (li.unitPrice || 0),
    0,
  );

  const estRevenue = proposal.estimatedPrice;
  const estGrossProfit = Math.round(estRevenue * 0.4);
  const grossMarginPct = estRevenue > 0 ? 40 : 0;

  // --- Create the job (pre-filled from the quote) ---
  const existingJobNumbers = await db
    .select({ jobNumber: jobsTable.jobNumber })
    .from(jobsTable);
  const jobValues: JobInsert = {
    id: randomUUID(),
    jobNumber: nextNumber(
      existingJobNumbers.map((j) => j.jobNumber),
      "J",
    ),
    customerName: proposal.customerName,
    phone: "",
    email: "",
    address: "",
    city: proposal.projectLocation,
    flooringType: proposal.flooringType,
    rooms: proposal.roomList ?? [],
    scopeOfWork: proposal.scopeOfWork,
    squareFootage: proposal.totalSqFt,
    crewAssigned: "Unassigned",
    salespersonId: proposal.salespersonId ?? null,
    materialStatus: "Ordered",
    laborEstimate: 0,
    estLaborHours: 0,
    materialEstimate,
    estRevenue,
    estGrossProfit,
    grossMarginPct,
    actualRevenue: 0,
    actualLaborCost: 0,
    actualMaterialCost: 0,
    actualAddOnCost: 0,
    notes: `Created from accepted quote for ${proposal.customerName}.`,
    priorityLevel: "Medium",
    riskLevel: "Low",
    status: "Approved",
    stageHistory: [{ stage: "Approved", at: now }],
    shareToken: generateShareToken(),
    createdAt: now,
    updatedAt: now,
  };
  const [job] = await db.insert(jobsTable).values(jobValues).returning();

  // Each selected catalog product becomes a per-job material (the job's
  // "Materials Needed" list).
  if (lineItems.length > 0) {
    const materialRows: JobMaterialInsert[] = lineItems.map((li) => ({
      id: randomUUID(),
      jobId: job.id,
      name: li.name,
      quantity: li.quantity || 0,
      unit: li.unit || "",
      createdAt: now,
    }));
    await db.insert(jobMaterialsTable).values(materialRows);
  }

  // Seed a per-job material-readiness record so the new job shows up on the
  // materials tracking board.
  const readiness: MaterialInsert = {
    id: randomUUID(),
    jobId: job.id,
    jobNumber: job.jobNumber,
    customer: job.customerName,
    city: job.city,
    flooringType: job.flooringType,
    supplier: "",
    orderedDate: now.slice(0, 10),
    received: false,
    damaged: false,
    missingItems: "",
    notes: "Created from converted quote.",
    status: "Ordered",
  };
  await db.insert(materialsTable).values(readiness);

  // --- Create the draft invoice ---
  const invoiceLineItems: InvoiceLineItem[] = [
    {
      id: randomUUID(),
      description:
        proposal.scopeOfWork ||
        `${proposal.flooringType} flooring — ${proposal.totalSqFt} sq ft`,
      category: "Materials",
      quantity: 1,
      unitPrice: proposal.estimatedPrice,
    },
  ];
  const subtotal = invoiceLineItems.reduce(
    (acc, item) => acc + (item.quantity || 0) * (item.unitPrice || 0),
    0,
  );
  const depositAmount = depositAmountFor(proposal);

  const existingInvoiceNumbers = await db
    .select({ invoiceNumber: invoicesTable.invoiceNumber })
    .from(invoicesTable);
  const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const invoiceValues: InvoiceInsert = {
    id: randomUUID(),
    invoiceNumber: nextNumber(
      existingInvoiceNumbers.map((i) => i.invoiceNumber),
      "INV",
    ),
    jobId: job.id,
    jobNumber: job.jobNumber,
    customerName: proposal.customerName,
    lineItems: invoiceLineItems,
    subtotal,
    taxableAmount: subtotal,
    total: subtotal,
    depositAmount,
    balanceAmount: Math.max(0, subtotal - depositAmount),
    status: "Draft",
    issueDate: now.slice(0, 10),
    dueDate,
    notes: proposal.paymentTerms
      ? `Payment terms: ${proposal.paymentTerms}`
      : "",
    createdAt: now,
    updatedAt: now,
  };
  const [invoice] = await db
    .insert(invoicesTable)
    .values(invoiceValues)
    .returning();

  // --- Link the proposal to the created records ---
  await db
    .update(proposalsTable)
    .set({ jobId: job.id, convertedJobId: job.id, convertedInvoiceId: invoice.id })
    .where(eq(proposalsTable.id, proposal.id));

  await queueQuickBooksReview("customer", job.id, "create", stripNulls(job));
  await queueQuickBooksReview("project", job.id, "create", stripNulls(job), ["Customer must be linked before this project is approved"]);
  await queueQuickBooksReview("invoice", invoice.id, "create", stripNulls(invoice), ["Confirm the QuickBooks tax code before approval"]);

  res.status(201).json(
    ConvertProposalResponse.parse({
      job: stripNulls(job),
      invoice: stripNulls(invoice),
      materialsCreated: lineItems.length,
    }),
  );
});

export default router;
