import type { Job, Lead } from "./types";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

type AddJob = (
  jobData: Omit<
    Job,
    "id" | "jobNumber" | "createdAt" | "updatedAt" | "stageHistory" | "shareToken"
  >,
) => Promise<Job>;

type UpdateLead = (id: string, updates: Partial<Lead>) => Promise<void>;

export async function convertLeadToJob(
  lead: Lead,
  deps: { addJob: AddJob; updateLead: UpdateLead },
): Promise<Job> {
  const newJob = await deps.addJob({
    customerName: lead.customerName,
    phone: lead.phone,
    email: lead.email,
    address: lead.address,
    city: lead.city,
    flooringType: lead.flooringInterest,
    rooms: [],
    squareFootage: 0,
    scopeOfWork: "",
    estLaborHours: 0,
    crewAssigned: "Unassigned",
    materialStatus: "Ordered",
    laborEstimate: 0,
    materialEstimate: 0,
    estRevenue: lead.estimatedValue,
    estGrossProfit: Math.round(lead.estimatedValue * 0.4),
    grossMarginPct: 40,
    actualRevenue: 0,
    actualLaborCost: 0,
    actualMaterialCost: 0,
    actualAddOnCost: 0,
    notes: `Converted from lead. ${lead.notes}`.trim(),
    priorityLevel: "Medium",
    riskLevel: "Low",
    status: "Approved",
  });

  const activity = {
    id: crypto.randomUUID(),
    date: todayISO(),
    type: "Stage Change" as const,
    note: `Lead won and converted to job ${newJob.jobNumber}.`,
  };

  await deps.updateLead(lead.id, {
    stage: "Won",
    convertedJobId: newJob.id,
    activityLog: [...lead.activityLog, activity],
  });

  return newJob;
}

export async function markLeadLost(
  lead: Lead,
  reason: string,
  deps: { updateLead: UpdateLead },
): Promise<void> {
  const finalReason = reason.trim() || "Not specified";
  const activity = {
    id: crypto.randomUUID(),
    date: todayISO(),
    type: "Stage Change" as const,
    note: `Lead marked Lost. Reason: ${finalReason}.`,
  };

  await deps.updateLead(lead.id, {
    stage: "Lost",
    lostReason: finalReason,
    activityLog: [...lead.activityLog, activity],
  });
}
