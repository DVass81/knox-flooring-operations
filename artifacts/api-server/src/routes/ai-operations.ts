import { randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import { aiRequestAuditsTable, db, invoicesTable, jobsTable, leadsTable, materialsTable, proposalsTable, tasksTable } from "@workspace/db";
import { requireRole } from "../middlewares/auth";
import { createStructuredResponse, getOpenAIModel, hasOpenAI } from "../lib/openai";

const router: IRouter = Router();
const PROMPT_VERSION = "knox-operations-brief-2026.1";

type Priority = {
  id: string;
  function: "Sales" | "Operations" | "Finance";
  urgency: "critical" | "high" | "normal";
  title: string;
  reason: string;
  nextAction: string;
  href: string;
};

type BriefingAI = {
  executiveSummary: string;
  priorityIds: string[];
  handoffs: string[];
  opportunities: string[];
  risks: string[];
  confidence: "low" | "medium" | "high";
};

const briefingSchema = {
  type: "object",
  additionalProperties: false,
  required: ["executiveSummary", "priorityIds", "handoffs", "opportunities", "risks", "confidence"],
  properties: {
    executiveSummary: { type: "string" },
    priorityIds: { type: "array", items: { type: "string" } },
    handoffs: { type: "array", items: { type: "string" } },
    opportunities: { type: "array", items: { type: "string" } },
    risks: { type: "array", items: { type: "string" } },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
  },
};

const urgencyWeight = { critical: 0, high: 1, normal: 2 } as const;

router.post("/ai/operations-brief", requireRole("owner", "sales", "operations"), async (req, res) => {
  const started = Date.now();
  const [leads, jobs, invoices, tasks, materials, proposals] = await Promise.all([
    db.select().from(leadsTable),
    db.select().from(jobsTable),
    db.select().from(invoicesTable),
    db.select().from(tasksTable),
    db.select().from(materialsTable),
    db.select().from(proposalsTable),
  ]);
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const priorities: Priority[] = [];

  for (const invoice of invoices) {
    const balance = Math.max(0, invoice.balanceAmount || invoice.total - invoice.depositAmount - invoice.paidAmount + invoice.refundedAmount);
    if (balance <= 0 || invoice.status === "Draft") continue;
    const overdue = invoice.status === "Overdue" || Boolean(invoice.dueDate && invoice.dueDate < today);
    priorities.push({
      id: `invoice:${invoice.id}`,
      function: "Finance",
      urgency: overdue ? "critical" : "high",
      title: `${overdue ? "Collect overdue" : "Review open"} invoice ${invoice.invoiceNumber}`,
      reason: `$${Math.round(balance).toLocaleString()} remains open${invoice.dueDate ? `; due ${invoice.dueDate}` : ""}.`,
      nextAction: overdue ? "Confirm the payment contact and record the next collection step." : "Confirm delivery, approval, and expected payment date.",
      href: "/invoices",
    });
  }
  for (const lead of leads) {
    if (["Won", "Lost"].includes(lead.stage) || !lead.followUpDate || lead.followUpDate > today) continue;
    priorities.push({
      id: `lead:${lead.id}`,
      function: "Sales",
      urgency: lead.followUpDate < today ? "high" : "normal",
      title: `Follow up on ${lead.flooringInterest} opportunity`,
      reason: `${lead.stage} lead in ${lead.city || "the service area"}; approximately $${Math.round(lead.estimatedValue).toLocaleString()} potential value.`,
      nextAction: "Open the lead, make contact, and schedule the next measurable commitment.",
      href: `/leads/${lead.id}`,
    });
  }
  for (const material of materials) {
    const atRisk = material.damaged || Boolean(material.missingItems) || (!material.received && Boolean(material.expectedDeliveryDate && material.expectedDeliveryDate <= today));
    if (!atRisk) continue;
    priorities.push({
      id: `material:${material.id}`,
      function: "Operations",
      urgency: material.damaged || Boolean(material.missingItems) ? "critical" : "high",
      title: `Resolve material exception for ${material.jobNumber}`,
      reason: material.damaged ? "Material is marked damaged." : material.missingItems ? `Missing: ${material.missingItems}.` : `Expected by ${material.expectedDeliveryDate} but not received.`,
      nextAction: "Confirm the supplier recovery date before committing the crew schedule.",
      href: "/materials",
    });
  }
  for (const job of jobs) {
    if (job.riskLevel !== "High" && !/delay|backorder|issue/i.test(job.materialStatus)) continue;
    priorities.push({
      id: `job:${job.id}`,
      function: "Operations",
      urgency: job.riskLevel === "High" ? "high" : "normal",
      title: `Review risk on ${job.jobNumber}`,
      reason: `${job.flooringType}; risk ${job.riskLevel}; materials ${job.materialStatus}.`,
      nextAction: "Confirm scope, materials, and schedule dependencies with the assigned owner.",
      href: `/jobs/${job.id}`,
    });
  }
  for (const task of tasks) {
    if (task.status === "Completed" || task.endAt > now.toISOString()) continue;
    priorities.push({
      id: `task:${task.id}`,
      function: "Operations",
      urgency: "normal",
      title: task.title,
      reason: `Open task passed its scheduled end time (${task.endAt.slice(0, 10)}).`,
      nextAction: "Complete, reassign, or reschedule this task with a clear owner.",
      href: "/tasks",
    });
  }
  const orderedCandidates = priorities.sort((a, b) => urgencyWeight[a.urgency] - urgencyWeight[b.urgency]).slice(0, 12);
  const metrics = {
    openLeads: leads.filter((lead) => !["Won", "Lost"].includes(lead.stage)).length,
    activeJobs: jobs.filter((job) => !["Completed", "Paid", "Cancelled"].includes(job.status)).length,
    openInvoiceBalance: Math.round(invoices.reduce((sum, invoice) => sum + (invoice.status === "Draft" ? 0 : Math.max(0, invoice.balanceAmount)), 0)),
    overdueInvoices: invoices.filter((invoice) => invoice.status === "Overdue").length,
    materialExceptions: materials.filter((material) => material.damaged || Boolean(material.missingItems) || (!material.received && Boolean(material.expectedDeliveryDate && material.expectedDeliveryDate <= today))).length,
    proposalsAwaitingDecision: proposals.filter((proposal) => ["Sent", "Viewed"].includes(proposal.status)).length,
  };
  const fallback: BriefingAI = {
    executiveSummary: `${metrics.openLeads} open leads, ${metrics.activeJobs} active jobs, and $${metrics.openInvoiceBalance.toLocaleString()} in open invoicing require a coordinated sales, operations, and finance rhythm.`,
    priorityIds: orderedCandidates.map((item) => item.id),
    handoffs: ["Sales should confirm accepted scope before Operations reserves labor.", "Operations should confirm material readiness before customer schedule commitments.", "Finance should follow payment status back into the job record so margin and closeout stay accurate."],
    opportunities: metrics.proposalsAwaitingDecision ? [`${metrics.proposalsAwaitingDecision} proposals are awaiting a customer decision and are the fastest near-term revenue opportunity.`] : ["Focus sales effort on measured and quoted opportunities with clear next steps."],
    risks: metrics.materialExceptions ? [`${metrics.materialExceptions} material exceptions may affect committed install dates.`] : ["No material exception is currently blocking the top-priority schedule."],
    confidence: "high",
  };

  let analysis = fallback;
  let mode: "live" | "fallback" = "fallback";
  let model = getOpenAIModel();
  let inputTokens = 0;
  let outputTokens = 0;
  let fallbackReason: string | undefined;
  if (hasOpenAI()) {
    try {
      const ai = await createStructuredResponse<BriefingAI>({
        schemaName: "knox_operations_brief",
        schema: briefingSchema,
        instructions: "You are the Knoxville Flooring operations chief of staff. Prioritize only the supplied candidate IDs. Do not invent customers, amounts, dates, jobs, or actions. Connect handoffs across Sales, Operations, and Finance. Keep the executive summary and recommendations concise and operational. Return each supplied priority ID at most once.",
        input: { metrics, candidates: orderedCandidates.map(({ id, function: area, urgency, title, reason, nextAction }) => ({ id, area, urgency, title, reason, nextAction })) },
        promptCacheKey: PROMPT_VERSION,
        safetyIdentifier: req.auth!.userId,
        maxOutputTokens: 1200,
      });
      analysis = ai.value;
      model = ai.model;
      inputTokens = ai.usage.inputTokens;
      outputTokens = ai.usage.outputTokens;
      mode = "live";
    } catch (error) {
      fallbackReason = error instanceof Error ? error.message : "AI unavailable";
    }
  }
  const byId = new Map(orderedCandidates.map((item) => [item.id, item]));
  const selectedIds = [...new Set(analysis.priorityIds)].filter((id) => byId.has(id));
  const remainingIds = orderedCandidates.map((item) => item.id).filter((id) => !selectedIds.includes(id));
  const resultPriorities = [...selectedIds, ...remainingIds].slice(0, 8).map((id) => byId.get(id)!);
  await db.insert(aiRequestAuditsTable).values({ id: randomUUID(), userId: req.auth!.userId, model, promptVersion: PROMPT_VERSION, status: mode === "live" ? "success" : "fallback", latencyMs: Date.now() - started, inputTokens, outputTokens, estimatedCostMicros: 0, createdAt: new Date().toISOString() });
  res.json({ ...analysis, priorityIds: undefined, priorities: resultPriorities, metrics, mode, model: mode === "live" ? model : null, promptVersion: PROMPT_VERSION, fallbackReason, generatedAt: new Date().toISOString() });
});

export default router;
