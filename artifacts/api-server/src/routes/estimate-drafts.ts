import { Router } from "express";
import { randomUUID, randomBytes } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  estimateDraftsTable,
  proposalsTable,
  customersTable,
  customerSitesTable,
  jobsTable,
} from "@workspace/db";
import { requireRole } from "../middlewares/auth";
import { domainRoute, parse, revision, id } from "../lib/domain-http";
import { assertRevision, DomainError } from "../lib/operations-rules";
import { estimateInputSchema, reviewedEstimate } from "../lib/estimate-service";
import { insertSnapshotJob } from "../lib/conversions";
import { sellingQuoteLines } from "../lib/quote-lines";
import type { EstimateSnapshot } from "@workspace/domain";

const router = Router();
router.use("/estimate-drafts", requireRole("owner", "sales"));
const draftInput = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().max(200).default("Untitled estimate"),
  inputs: estimateInputSchema,
});
router.get(
  "/estimate-drafts",
  domainRoute(async (req, res) => {
    res.json(
      await db
        .select()
        .from(estimateDraftsTable)
        .where(eq(estimateDraftsTable.ownerUserId, req.auth!.userId)),
    );
  }),
);
router.get(
  "/estimate-drafts/:id",
  domainRoute(async (req, res) => {
    const [draft] = await db
      .select()
      .from(estimateDraftsTable)
      .where(
        and(
          eq(estimateDraftsTable.id, id(req)),
          eq(estimateDraftsTable.ownerUserId, req.auth!.userId),
        ),
      );
    if (!draft) throw new DomainError(404, "Draft not found");
    res.json(draft);
  }),
);
router.post(
  "/estimate-drafts",
  domainRoute(async (req, res) => {
    const data = parse(draftInput, req.body);
    const result = await db.transaction(async (tx) => {
      if (data.id)
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtext(${"draft:" + data.id}))`,
        );
      if (data.id) {
        const [existing] = await tx
          .select()
          .from(estimateDraftsTable)
          .where(eq(estimateDraftsTable.id, data.id));
        if (existing) {
          if (existing.ownerUserId !== req.auth!.userId)
            throw new DomainError(404, "Draft not found");
          if (
            !isDeepStrictEqual(existing.inputs, data.inputs) ||
            existing.title !== data.title
          )
            throw new DomainError(
              409,
              "This draft already exists. Refresh it before saving changes.",
              { draft: existing },
            );
          return existing;
        }
      }
      const snapshot = await reviewedEstimate(tx, data.inputs);
      const now = new Date().toISOString();
      const [draft] = await tx
        .insert(estimateDraftsTable)
        .values({
          id: data.id ?? randomUUID(),
          ownerUserId: req.auth!.userId,
          title: data.title,
          inputs: snapshot.inputs as unknown as Record<string, unknown>,
          snapshot: snapshot as unknown as Record<string, unknown>,
          customerId: snapshot.inputs.customerId,
          siteId: snapshot.inputs.siteId,
          leadId: snapshot.inputs.leadId,
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      return draft;
    });
    res.status(201).json(result);
  }),
);
router.patch(
  "/estimate-drafts/:id",
  domainRoute(async (req, res) => {
    const data = parse(
      draftInput.omit({ id: true }).partial().extend({ revision }),
      req.body,
    );
    const result = await db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(estimateDraftsTable)
        .where(
          and(
            eq(estimateDraftsTable.id, id(req)),
            eq(estimateDraftsTable.ownerUserId, req.auth!.userId),
          ),
        )
        .for("update");
      if (!current) throw new DomainError(404, "Draft not found");
      assertRevision(current.revision, data.revision);
      if (current.state !== "Draft")
        throw new DomainError(
          409,
          "This draft has already been converted. Create a new draft for revisions.",
        );
      const snapshot = await reviewedEstimate(
        tx,
        data.inputs ?? current.inputs,
        current.snapshot,
      );
      const [row] = await tx
        .update(estimateDraftsTable)
        .set({
          title: data.title ?? current.title,
          inputs: snapshot.inputs as unknown as Record<string, unknown>,
          snapshot: snapshot as unknown as Record<string, unknown>,
          customerId: snapshot.inputs.customerId ?? null,
          siteId: snapshot.inputs.siteId ?? null,
          leadId: snapshot.inputs.leadId ?? null,
          revision: current.revision + 1,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(estimateDraftsTable.id, current.id))
        .returning();
      return row;
    });
    res.json(result);
  }),
);
router.post(
  "/estimate-drafts/:id/convert",
  domainRoute(async (req, res) => {
    const data = parse(
      z.object({ revision, target: z.enum(["proposal", "job"]) }),
      req.body,
    );
    const result = await db.transaction(async (tx) => {
      const [draft] = await tx
        .select()
        .from(estimateDraftsTable)
        .where(
          and(
            eq(estimateDraftsTable.id, id(req)),
            eq(estimateDraftsTable.ownerUserId, req.auth!.userId),
          ),
        )
        .for("update");
      if (!draft) throw new DomainError(404, "Draft not found");
      if (draft.state === "Converted") {
        if (
          (data.target === "proposal" && !draft.convertedProposalId) ||
          (data.target === "job" && !draft.convertedJobId)
        )
          throw new DomainError(
            409,
            "This draft was already converted to a different document.",
          );
        const linked =
          data.target === "job"
            ? await tx
                .select({ id: jobsTable.id })
                .from(jobsTable)
                .where(eq(jobsTable.id, draft.convertedJobId!))
            : await tx
                .select({ id: proposalsTable.id })
                .from(proposalsTable)
                .where(eq(proposalsTable.id, draft.convertedProposalId!));
        if (!linked.length)
          throw new DomainError(
            409,
            "The converted document is missing. Resolve its existing link before retrying.",
          );
        return {
          draft,
          proposalId: draft.convertedProposalId ?? undefined,
          jobId: draft.convertedJobId ?? undefined,
        };
      }
      assertRevision(draft.revision, data.revision);
      const snapshot = await reviewedEstimate(tx, draft.inputs, draft.snapshot);
      if (!snapshot.valid)
        throw new DomainError(
          400,
          "Complete the estimate before converting it.",
          { issues: snapshot.issues },
        );
      const now = new Date().toISOString();
      if (!snapshot.inputs.customerId) {
        const [customer] = await tx
          .insert(customersTable)
          .values({
            id: randomUUID(),
            name: snapshot.inputs.customerName,
            createdAt: now,
            updatedAt: now,
          })
          .returning();
        snapshot.inputs.customerId = customer.id;
      }
      let proposalId: string | undefined;
      let jobId: string | undefined;
      if (data.target === "job") {
        const job = await insertSnapshotJob(tx, snapshot);
        jobId = job.id;
      } else {
        const [proposal] = await tx
          .insert(proposalsTable)
          .values({
            id: randomUUID(),
            customerId: snapshot.inputs.customerId,
            siteId: snapshot.inputs.siteId,
            customerName: snapshot.inputs.customerName,
            projectLocation: snapshot.inputs.city,
            flooringType: snapshot.inputs.flooringType,
            roomList: snapshot.inputs.rooms,
            totalSqFt: snapshot.rawSqFt,
            scopeOfWork: snapshot.summary,
            estimatedPrice: snapshot.sellingPrice,
            expectedTimeline:
              "Dates subject to confirmed materials and crew availability",
            materialAssumptions: `Reviewed waste: ${snapshot.inputs.wastePercent}%`,
            exclusions: "",
            warrantyNote: "",
            status: "Draft",
            shareToken: randomBytes(12).toString("hex"),
            lineItems: sellingQuoteLines(snapshot),
            estimateSnapshot: snapshot as unknown as Record<string, unknown>,
            createdAt: now,
          })
          .returning();
        proposalId = proposal.id;
      }
      const [converted] = await tx
        .update(estimateDraftsTable)
        .set({
          state: "Converted",
          convertedProposalId: proposalId,
          convertedJobId: jobId,
          customerId: snapshot.inputs.customerId,
          inputs: snapshot.inputs as unknown as Record<string, unknown>,
          snapshot: snapshot as unknown as Record<string, unknown>,
          revision: draft.revision + 1,
          updatedAt: now,
        })
        .where(eq(estimateDraftsTable.id, draft.id))
        .returning();
      return { draft: converted, proposalId, jobId };
    });
    res.json(result);
  }),
);
export default router;
