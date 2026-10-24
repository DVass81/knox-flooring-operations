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
import { convertProposal } from "../lib/conversions";
import { domainRoute } from "../lib/domain-http";
import { ensureCustomer, validateCustomerLinks } from "../lib/estimate-service";
import { assertRevision, DomainError } from "../lib/operations-rules";

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
    return (
      Math.round(
        (proposal.estimatedPrice || 0) * (proposal.depositValue || 0),
      ) / 100
    );
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

router.post(
  "/proposals",
  domainRoute(async (req, res) => {
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

    const proposal = await db.transaction(async (tx) => {
      const customerId = await ensureCustomer(tx, parsed.data);
      const [row] = await tx
        .insert(proposalsTable)
        .values({ ...values, customerId })
        .returning();
      return row;
    });
    await queueQuickBooksReview(
      "estimate",
      proposal.id,
      "create",
      stripNulls(proposal),
      ["Customer must be reconciled before this estimate is approved"],
    );
    res.status(201).json(UpdateProposalResponse.parse(stripNulls(proposal)));
  }),
);

router.patch(
  "/proposals/:id",
  domainRoute(async (req, res) => {
    const params = UpdateProposalParams.parse(req.params);
    const parsed = UpdateProposalBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { revision, ...data } = parsed.data;
    const proposal = await db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(proposalsTable)
        .where(eq(proposalsTable.id, params.id))
        .for("update");
      if (!current) throw new DomainError(404, "Proposal not found");
      assertRevision(current.revision, revision);
      if (["Accepted", "Declined"].includes(current.status))
        throw new DomainError(
          409,
          "Accepted and declined quotes are preserved. Create a new draft for changes.",
        );
      await validateCustomerLinks(
        tx,
        data.customerId === undefined ? current.customerId : data.customerId,
        data.siteId === undefined ? current.siteId : data.siteId,
      );
      const now = new Date().toISOString();
      const updates: Partial<ProposalInsert> = {
        ...data,
        revision: current.revision + 1,
      };
      if (data.status === "Sent" && !current.sentAt) updates.sentAt = now;
      if (data.status === "Viewed" && !current.viewedAt) updates.viewedAt = now;
      if (data.status === "Accepted" && !current.acceptedAt)
        updates.acceptedAt = now;
      if (data.status === "Declined" && !current.declinedAt)
        updates.declinedAt = now;
      if (data.status === "Sent" && !current.shareToken)
        updates.shareToken = generateShareToken();
      if (
        current.estimateSnapshot &&
        [
          "lineItems",
          "estimatedPrice",
          "roomList",
          "totalSqFt",
          "flooringType",
          "estimateSnapshot",
        ].some((key) => key in data)
      )
        throw new DomainError(
          409,
          "Revise pricing through a new estimate draft to keep the reviewed cost snapshot consistent.",
        );
      const [row] = await tx
        .update(proposalsTable)
        .set(updates)
        .where(eq(proposalsTable.id, current.id))
        .returning();
      return row;
    });
    await queueQuickBooksReview(
      "estimate",
      proposal.id,
      "update",
      stripNulls(proposal),
      ["Customer must be reconciled before approval"],
    );
    res.json(UpdateProposalResponse.parse(stripNulls(proposal)));
  }),
);

router.post(
  "/proposals/:id/convert",
  domainRoute(async (req, res) => {
    const result = await db.transaction((tx) =>
      convertProposal(tx, String(req.params.id)),
    );
    res.json(
      ConvertProposalResponse.parse({
        job: stripNulls(result.job),
        invoice: stripNulls(result.invoice),
        materialsCreated: result.materialsCreated,
      }),
    );
  }),
);

export default router;
