import { Router, type IRouter } from "express";
import { eq, or } from "drizzle-orm";
import {
  db,
  jobsTable,
  jobPhotosTable,
  settingsTable,
  proposalsTable,
  invoicesTable,
  type ProposalRow,
} from "@workspace/db";
import {
  GetPublicJobParams,
  GetPublicJobResponse,
  GetPublicQuoteParams,
  GetPublicQuoteResponse,
  AcceptPublicQuoteParams,
  AcceptPublicQuoteBody,
  AcceptPublicQuoteResponse,
  DeclinePublicQuoteParams,
  DeclinePublicQuoteResponse,
} from "@workspace/api-zod";
import { stripNulls } from "../lib/strip-nulls";
import { depositAmountFor } from "./proposals";

const router: IRouter = Router();

async function publicQuotePayload(proposal: ProposalRow) {
  const [settings] = await db.select().from(settingsTable);
  return stripNulls({
    customerName: proposal.customerName,
    projectLocation: proposal.projectLocation,
    flooringType: proposal.flooringType,
    roomList: proposal.roomList,
    totalSqFt: proposal.totalSqFt,
    scopeOfWork: proposal.scopeOfWork,
    estimatedPrice: proposal.estimatedPrice,
    expectedTimeline: proposal.expectedTimeline,
    materialAssumptions: proposal.materialAssumptions,
    exclusions: proposal.exclusions,
    warrantyNote: proposal.warrantyNote,
    depositType: proposal.depositType,
    depositValue: proposal.depositValue,
    depositAmount: depositAmountFor(proposal),
    paymentTerms: proposal.paymentTerms,
    status: proposal.status,
    acceptedAt: proposal.acceptedAt,
    declinedAt: proposal.declinedAt,
    signature: proposal.signature,
    company: {
      companyName: settings?.companyName ?? "",
      phone: settings?.phone ?? "",
      email: settings?.email ?? "",
      website: settings?.website ?? "",
    },
  });
}

async function findQuoteByToken(token: string): Promise<ProposalRow | null> {
  if (!token) return null;
  const [proposal] = await db
    .select()
    .from(proposalsTable)
    .where(eq(proposalsTable.shareToken, token));
  return proposal && proposal.shareToken ? proposal : null;
}

router.get("/public/jobs/:token", async (req, res): Promise<void> => {
  const params = GetPublicJobParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [job] = await db
    .select()
    .from(jobsTable)
    .where(eq(jobsTable.shareToken, params.data.token));

  if (!job || !job.shareToken) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const photos = await db
    .select()
    .from(jobPhotosTable)
    .where(eq(jobPhotosTable.jobId, job.id));

  const [settings] = await db.select().from(settingsTable);

  // Quote linked to this job (created from it or converted into it).
  const linkedProposals = await db
    .select()
    .from(proposalsTable)
    .where(
      or(
        eq(proposalsTable.convertedJobId, job.id),
        eq(proposalsTable.jobId, job.id),
      ),
    );
  // Prefer a converted quote, then most recently created.
  const proposal =
    [...linkedProposals]
      .sort((a, b) => {
        const aConv = a.convertedJobId === job.id ? 1 : 0;
        const bConv = b.convertedJobId === job.id ? 1 : 0;
        if (aConv !== bConv) return bConv - aConv;
        return (b.createdAt || "").localeCompare(a.createdAt || "");
      })[0] ?? null;

  const quote = proposal
    ? stripNulls({
        shareToken: proposal.shareToken,
        customerName: proposal.customerName,
        projectLocation: proposal.projectLocation,
        flooringType: proposal.flooringType,
        roomList: proposal.roomList,
        totalSqFt: proposal.totalSqFt,
        scopeOfWork: proposal.scopeOfWork,
        estimatedPrice: proposal.estimatedPrice,
        expectedTimeline: proposal.expectedTimeline,
        materialAssumptions: proposal.materialAssumptions,
        exclusions: proposal.exclusions,
        warrantyNote: proposal.warrantyNote,
        depositType: proposal.depositType,
        depositValue: proposal.depositValue,
        depositAmount: depositAmountFor(proposal),
        paymentTerms: proposal.paymentTerms,
        status: proposal.status,
        acceptedAt: proposal.acceptedAt,
        declinedAt: proposal.declinedAt,
        signature: proposal.signature,
      })
    : null;

  const invoiceRows = await db
    .select()
    .from(invoicesTable)
    .where(eq(invoicesTable.jobId, job.id));
  const sortedInvoices = [...invoiceRows].sort((a, b) =>
    (b.issueDate || "").localeCompare(a.issueDate || ""),
  );

  const invoices = sortedInvoices.map((inv) =>
    stripNulls({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      lineItems: inv.lineItems,
      subtotal: inv.subtotal,
      taxableAmount: inv.taxableAmount,
      taxAmount: inv.taxAmount,
      discountAmount: inv.discountAmount,
      total: inv.total,
      depositAmount: inv.depositAmount,
      paidAmount: inv.paidAmount,
      balanceAmount: inv.balanceAmount,
      refundedAmount: inv.refundedAmount,
      taxCode: inv.taxCode,
      paymentReference: inv.paymentReference,
      paidAt: inv.paidAt,
      status: inv.status,
      issueDate: inv.issueDate,
      dueDate: inv.dueDate,
      notes: inv.notes,
    }),
  );

  // Payment balances are imported from QuickBooks when connected.
  const invoicedTotal = sortedInvoices
    .filter((inv) => inv.status !== "Draft")
    .reduce((sum, inv) => sum + (inv.total || 0), 0);
  const paidTotal = sortedInvoices.reduce(
    (sum, inv) => sum + (inv.paidAmount || 0) + (inv.depositAmount || 0) - (inv.refundedAmount || 0),
    0,
  );
  const outstanding = Math.max(0, invoicedTotal - paidTotal);

  const publicJob = stripNulls({
    jobNumber: job.jobNumber,
    customerName: job.customerName,
    address: job.address,
    city: job.city,
    flooringType: job.flooringType,
    crewAssigned: job.crewAssigned,
    squareFootage: job.squareFootage,
    estStartDate: job.estStartDate,
    estCompletionDate: job.estCompletionDate,
    status: job.status,
    stageHistory: job.stageHistory,
    photos: photos.map(stripNulls),
    quote,
    invoices,
    balance: { invoicedTotal, paidTotal, outstanding },
    company: {
      companyName: settings?.companyName ?? "",
      phone: settings?.phone ?? "",
      email: settings?.email ?? "",
      website: settings?.website ?? "",
    },
  });

  res.json(GetPublicJobResponse.parse(publicJob));
});

router.get("/public/quotes/:token", async (req, res): Promise<void> => {
  const params = GetPublicQuoteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  let proposal = await findQuoteByToken(params.data.token);
  if (!proposal) {
    res.status(404).json({ error: "Quote not found" });
    return;
  }

  // First view of a sent quote flips it to Viewed.
  if (proposal.status === "Sent") {
    const now = new Date().toISOString();
    const [updated] = await db
      .update(proposalsTable)
      .set({ status: "Viewed", viewedAt: proposal.viewedAt ?? now })
      .where(eq(proposalsTable.id, proposal.id))
      .returning();
    if (updated) proposal = updated;
  }

  res.json(GetPublicQuoteResponse.parse(await publicQuotePayload(proposal)));
});

router.post("/public/quotes/:token/accept", async (req, res): Promise<void> => {
  const params = AcceptPublicQuoteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = AcceptPublicQuoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const proposal = await findQuoteByToken(params.data.token);
  if (!proposal) {
    res.status(404).json({ error: "Quote not found" });
    return;
  }

  if (!["Sent", "Viewed"].includes(proposal.status)) {
    res
      .status(400)
      .json({ error: "This quote can no longer be accepted." });
    return;
  }

  const now = new Date().toISOString();
  const [updated] = await db
    .update(proposalsTable)
    .set({
      status: "Accepted",
      acceptedAt: now,
      signature: parsed.data.signature.trim(),
    })
    .where(eq(proposalsTable.id, proposal.id))
    .returning();

  res.json(AcceptPublicQuoteResponse.parse(await publicQuotePayload(updated)));
});

router.post("/public/quotes/:token/decline", async (req, res): Promise<void> => {
  const params = DeclinePublicQuoteParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const proposal = await findQuoteByToken(params.data.token);
  if (!proposal) {
    res.status(404).json({ error: "Quote not found" });
    return;
  }

  if (!["Sent", "Viewed"].includes(proposal.status)) {
    res
      .status(400)
      .json({ error: "This quote can no longer be declined." });
    return;
  }

  const now = new Date().toISOString();
  const [updated] = await db
    .update(proposalsTable)
    .set({ status: "Declined", declinedAt: now })
    .where(eq(proposalsTable.id, proposal.id))
    .returning();

  res.json(DeclinePublicQuoteResponse.parse(await publicQuotePayload(updated)));
});

export default router;
