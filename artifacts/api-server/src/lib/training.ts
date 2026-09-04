export const TRAINING_MANIFEST_VERSION = "2026.3";

export type TrainingRole = "owner" | "sales" | "operations" | "installer";
export type TrainingPlacement = "top" | "right" | "bottom" | "left" | "center";
export type TrainingStepKind = "info" | "action";

export type TrainingStep = {
  id: string;
  route: string;
  target: string;
  placement: TrainingPlacement;
  kind: TrainingStepKind;
  title: string;
  explanation: string;
  instruction: string;
  narration: string;
  seconds: number;
};

export type MissionDefinition = {
  key: string;
  name: string;
  role: TrainingRole;
  minutes: number;
  summary: string;
  steps: TrainingStep[];
};

export type PageGuide = {
  key: string;
  name: string;
  route: string;
  role: TrainingRole[];
  summary: string;
  target: string;
  narration: string;
};

const info = (
  id: string,
  route: string,
  target: string,
  title: string,
  explanation: string,
  instruction: string,
  narration: string,
  placement: TrainingPlacement = "right",
  seconds = 28,
): TrainingStep => ({ id, route, target, placement, kind: "info", title, explanation, instruction, narration, seconds });

const action = (
  id: string,
  route: string,
  target: string,
  title: string,
  explanation: string,
  instruction: string,
  narration: string,
  placement: TrainingPlacement = "bottom",
  seconds = 32,
): TrainingStep => ({ id, route, target, placement, kind: "action", title, explanation, instruction, narration, seconds });

export const TRAINING_MISSIONS: MissionDefinition[] = [
  {
    key: "executive",
    name: "Executive Tour",
    role: "owner",
    minutes: 15,
    summary: "See the complete lead-to-payment story and the numbers Will needs to run the business.",
    steps: [
      info("executive-dashboard", "/", "nav-dashboard", "Your command center", "The dashboard brings sales, production, cash, crew load, and urgent exceptions into one owner view.", "Review the priority cards before moving into the sales pipeline.", "Welcome to the Knoxville Flooring command center. This page answers the owner's first questions every morning: what needs attention, what revenue is moving, and where a job may be at risk."),
      info("executive-pipeline", "/pipeline", "nav-pipeline", "From lead to won", "The pipeline makes every opportunity visible by stage so follow-ups do not disappear in email or paper notes.", "Notice how value and next actions move with each lead.", "The sales pipeline follows every opportunity from the first conversation through a won or lost decision. It gives the team a shared process and gives leadership a reliable forecast."),
      info("executive-ai", "/estimator", "estimator-ai", "AI-assisted estimating", "The copilot drafts scope, risk, labor, waste, and product guidance while Knox keeps final pricing and calculations authoritative.", "Review the AI control and the approval boundary around its suggestions.", "The quote copilot helps the estimator think faster without giving up control. It can suggest scope, waste, labor, and risks, but a person approves every recommendation and Knox performs the final math."),
      info("executive-job", "/jobs/4", "job-overview", "Follow the installation", "The job record connects scope, crew, schedule, material readiness, costs, notes, and progress photos.", "Review the commercial demonstration job and its current status.", "Once work is approved, the job record becomes the operating source of truth. Sales, operations, installers, and the owner can see the same scope, schedule, materials, and progress."),
      info("executive-invoice", "/invoices", "nav-invoices", "Invoice and payment visibility", "Invoices show deposits, paid amounts, balances, due dates, credits, and overdue risk.", "Review how accounting outcomes return to Knox without replacing its local records.", "The finance area keeps invoice status and customer balances visible to the owner. QuickBooks can remain the accounting authority while Knox shows the operational team exactly what has been paid and what remains."),
      info("executive-integrations", "/integration-health", "integration-health", "Trust every connection", "Integration Health distinguishes live, sandbox, simulated, disconnected, and error states so the demonstration never overstates a connection.", "Review OpenAI, QuickBooks, calendar, measurement, and communication status.", "The integration health page makes the system honest and supportable. Every connection is labeled clearly, with live AI usage and simulated demonstration services separated from production services.", "left"),
    ],
  },
  {
    key: "owner",
    name: "Owner Mission",
    role: "owner",
    minutes: 9,
    summary: "Review margin risks, cash flow, profitability, commissions, and accounting exceptions.",
    steps: [
      info("owner-priorities", "/", "dashboard-priorities", "Start with exceptions", "Priority alerts put overdue cash, material delays, risk, and unscheduled work ahead of decorative charts.", "Identify the item that needs an owner decision today.", "A useful owner dashboard should lead with exceptions, not decoration. These priorities identify cash, material, scheduling, and margin issues that deserve attention first."),
      info("owner-reports", "/reports", "nav-reports", "Profitability and trends", "Reports connect completed work to revenue, margin, flooring type, crews, and material delays.", "Compare revenue and profit rather than relying on sales volume alone.", "Reports turn completed work into operating insight. Revenue matters, but margin, crew performance, and recurring material delays reveal whether growth is healthy."),
      info("owner-receivables", "/invoices", "nav-invoices", "Protect cash flow", "The invoice view separates drafts, sent invoices, partial payments, paid work, and overdue balances.", "Locate an overdue or partially paid invoice and review its balance.", "Cash flow depends on knowing the difference between revenue booked and money collected. This view makes deposits, partial payments, balances, and overdue invoices easy to act on."),
      info("owner-commissions", "/commissions", "nav-commissions", "Commission control", "Commission reporting ties salesperson compensation to approved performance and the configured commission basis.", "Review the calculation basis before approving payouts.", "Commission reporting helps the owner reward performance without spreadsheet guesswork. The configured basis and rate stay visible so every payout can be explained."),
      action("owner-quickbooks", "/settings", "quickbooks-demo", "Approve accounting deliberately", "QuickBooks activity is approval-based. Operational edits do not silently become accounting transactions.", "Open the simulated QuickBooks review and select a pending record before continuing.", "The QuickBooks review queue is where the owner controls what reaches accounting. Each proposed customer, project, estimate, invoice, payment, or cost can be inspected before approval."),
    ],
  },
  {
    key: "sales",
    name: "Sales & Estimating Mission",
    role: "sales",
    minutes: 12,
    summary: "Capture a lead, measure rooms, create an AI quote, protect margin, and prepare a proposal.",
    steps: [
      action("sales-lead", "/leads", "leads-new", "Capture the opportunity", "A complete lead record creates accountability for the customer, source, next follow-up, and estimated value.", "Select New Lead and review the fields required to create a training lead. You may cancel without changing normal demo data.", "Start by capturing the opportunity while the conversation is fresh. Customer details, source, project type, value, and next action give the entire team a clean handoff."),
      action("sales-measure", "/estimator", "estimator-rooms", "Enter verified measurements", "Room measurements establish the quantity baseline used by waste, material, labor, and pricing calculations.", "Add or review a room and confirm that the square footage updates.", "Measurements are the foundation of a trustworthy flooring quote. Enter each room carefully and verify the total before asking AI or pricing tools to make recommendations."),
      action("sales-ai", "/estimator", "estimator-ai", "Ask the Quote Copilot", "AI analyzes supplied facts and catalog context but never invents prices, products, tax, or measurements.", "Generate AI recommendations, then review facts, assumptions, risks, and confidence.", "Now use the quote copilot to turn measurements and project notes into a structured recommendation. Pay attention to the distinction between supplied facts, calculated values, and AI assumptions."),
      info("sales-margin", "/estimator", "estimator-summary", "Protect the margin", "The pricing summary remains deterministic and shows material, labor, additional costs, selling price, and expected margin.", "Review the total and margin before creating a customer document.", "Before presenting a quote, confirm both the customer's total and the company's expected margin. AI can flag risk, but Knox remains responsible for every price extension and final total."),
      action("sales-proposal", "/estimator", "estimator-proposal", "Prepare the proposal", "Converting creates a branded proposal that can be reviewed before any customer communication is sent.", "Select Convert to Proposal only after the scope and pricing are ready. Training mode will not send externally.", "A proposal should communicate scope and value clearly, not just show a number. Conversion carries the approved estimate into a branded document for final review and customer acceptance."),
      info("sales-outbox", "/demo-outbox", "nav-demo-outbox", "Practice communication safely", "Demo emails and text messages are captured internally so training cannot contact a real customer.", "Review the safe outbox and confirm the simulated delivery label.", "The Demo Outbox makes customer communication safe to rehearse. Messages remain visible for review, but no email or text leaves the demonstration environment."),
    ],
  },
  {
    key: "operations",
    name: "Operations Mission",
    role: "operations",
    minutes: 10,
    summary: "Turn approved work into a scheduled, supplied installation with a clear crew handoff.",
    steps: [
      info("operations-accepted", "/jobs", "nav-jobs", "Find accepted work", "The jobs tracker shows the lifecycle after a customer accepts the work.", "Filter mentally for approved or material-stage work that needs an operational next action.", "Operations begins when sold work becomes executable work. The jobs tracker shows which projects need materials, dates, crews, or exception handling."),
      info("operations-materials", "/materials", "nav-materials", "Confirm material readiness", "Material readiness prevents a crew from arriving before product, transitions, padding, or sundries are available.", "Review ordered, received, ready, and delayed material states.", "Before promising an installation date, verify every required material. A single missing transition or delayed product can waste a crew day and damage the customer experience."),
      action("operations-crew", "/jobs", "jobs-new", "Assign responsibility", "Every scheduled job needs an accountable crew and a scope they can understand.", "Open the job editor and review the crew assignment control. Cancel to preserve normal demo data.", "Crew assignment makes ownership explicit. Match job complexity, product type, and timing to the appropriate team before committing the schedule."),
      info("operations-schedule", "/schedule", "nav-schedule", "Build a realistic schedule", "The crew schedule combines dates, workload, risk, and material readiness.", "Check for overlaps and warning badges before treating a date as committed.", "Scheduling is more than placing a job on a calendar. It requires a ready scope, ready materials, adequate labor, and room for known risks."),
      info("operations-exceptions", "/materials", "materials-overview", "Resolve exceptions early", "Delayed or incomplete material records stay visible until the responsible person can act.", "Identify a delayed order and the supplier or next action attached to it.", "Exception visibility keeps small issues from becoming missed installations. Delayed materials should have an owner, a supplier update, and a next decision date."),
    ],
  },
  {
    key: "installer",
    name: "Installer Mission",
    role: "installer",
    minutes: 9,
    summary: "Run an assigned installation from scope review through documented completion.",
    steps: [
      info("installer-job", "/jobs/4", "job-overview", "Open the assigned job", "The job header confirms the customer, address, stage, crew, and expected timing.", "Verify that you are working in the correct job before recording field activity.", "The installer starts with the assigned job. Confirm the address, schedule, crew, and job number before reviewing the detailed scope."),
      info("installer-scope", "/jobs/4", "job-scope", "Review scope before work", "Scope, flooring type, rooms, risks, and material notes define what the customer approved.", "Read the scope and risk notes before recording labor or progress.", "A clear scope prevents surprises in the field. Review rooms, product, preparation, transitions, risks, and customer expectations before installation begins."),
      action("installer-labor", "/jobs/4", "job-log-labor", "Record labor accurately", "Labor entries support costing, crew performance, payroll review, and project profitability.", "Open Log Labor, review the date, crew, hours, and notes, then close the practice dialog.", "Record labor on the day it occurs. Accurate crew and hour entries make job costing useful and help operations plan future work realistically."),
      action("installer-usage", "/jobs/4", "job-log-material", "Record material usage", "Actual usage explains waste, shortages, returns, and differences between estimate and final job cost.", "Open Log Usage and review the required material, quantity, unit, and cost fields.", "Material usage connects the warehouse and the job site. Recording actual quantities helps explain variance and improves future estimates."),
      action("installer-photos", "/jobs/4", "job-photos", "Document the work", "Progress and completion photos create a visual record for operations, the owner, and the customer portal.", "Review the photo stage, caption, and upload controls. Use only an approved training image.", "Photos make progress visible and protect everyone involved. Capture preparation, installation, details, and the completed room with useful captions."),
      info("installer-complete", "/jobs/4", "job-stage", "Request completion", "Completion should follow recorded labor, material usage, photos, notes, and a final scope check.", "Review the lifecycle control and confirm what evidence operations needs for closeout.", "Completion is a documented handoff, not just the end of installation. Confirm scope, notes, actuals, photos, and any remaining customer item before requesting closeout."),
    ],
  },
];

const allRoles: TrainingRole[] = ["owner", "sales", "operations", "installer"];
const ownerSales: TrainingRole[] = ["owner", "sales"];
const ownerOps: TrainingRole[] = ["owner", "operations"];

export const PAGE_GUIDES: PageGuide[] = [
  { key: "dashboard", name: "Dashboard", route: "/", role: allRoles, target: "nav-dashboard", summary: "Priorities, pipeline, production, cash, and workload at a glance.", narration: "Use the dashboard to decide what deserves attention first, then move into the underlying record for action." },
  { key: "ai-operations", name: "AI Operations Briefing", route: "/ai-operations", role: ownerSales.concat("operations"), target: "nav-ai-operations", summary: "A grounded daily briefing across leads, jobs, cash, and handoffs.", narration: "The AI operations briefing organizes current system facts into priorities and recommended next actions without changing records automatically." },
  { key: "leads", name: "Leads", route: "/leads", role: allRoles, target: "nav-leads", summary: "Capture, qualify, assign, and follow up with potential customers.", narration: "Leads are opportunities that have not yet become approved jobs. Keep contact details, source, value, and next action current." },
  { key: "pipeline", name: "Pipeline", route: "/pipeline", role: allRoles, target: "nav-pipeline", summary: "Visualize opportunities by sales stage and forecast value.", narration: "The pipeline helps the team see stalled opportunities and focus follow-up where it can move revenue." },
  { key: "estimator", name: "AI Quote Copilot", route: "/estimator", role: ownerSales, target: "nav-ai-quote-copilot", summary: "Combine measurements, catalog pricing, deterministic totals, and AI guidance.", narration: "The estimator keeps final quantities and prices under human control while AI helps draft scope, labor, waste, and risk guidance." },
  { key: "proposals", name: "Proposals", route: "/proposals", role: ownerSales, target: "nav-proposals", summary: "Review, send, revise, accept, and convert customer proposals.", narration: "Proposals turn an estimate into a customer-ready scope and price, while preserving approval and acceptance history." },
  { key: "jobs", name: "Jobs", route: "/jobs", role: allRoles, target: "nav-jobs", summary: "Manage approved work from preparation through completion.", narration: "Jobs connect the customer promise to scheduling, materials, installation, costs, documents, and closeout." },
  { key: "schedule", name: "Schedule", route: "/schedule", role: allRoles, target: "nav-schedule", summary: "Plan crews and installation dates with readiness warnings.", narration: "The schedule helps operations balance workload while checking material and risk conditions before a date is committed." },
  { key: "calendar", name: "Calendar", route: "/calendar", role: allRoles, target: "nav-calendar", summary: "See appointments, site visits, and installation events.", narration: "The calendar provides a time-based view of customer appointments and operational commitments." },
  { key: "tasks", name: "Task Calendar", route: "/tasks", role: allRoles, target: "nav-task-calendar", summary: "Assign follow-ups and operational tasks with due dates.", narration: "Tasks turn conversations and exceptions into accountable work with an owner and deadline." },
  { key: "materials", name: "Materials", route: "/materials", role: allRoles, target: "nav-materials", summary: "Track required, ordered, received, ready, and delayed materials.", narration: "Material readiness protects the schedule by showing what is available and what still threatens an installation." },
  { key: "inventory", name: "Inventory", route: "/inventory", role: allRoles, target: "nav-inventory", summary: "Maintain flooring products, services, pricing, stock, and reorder information.", narration: "The inventory catalog supplies the approved products and services used by estimates, proposals, and job costing." },
  { key: "invoices", name: "Invoices", route: "/invoices", role: ["owner"], target: "nav-invoices", summary: "Track totals, deposits, payments, balances, credits, and overdue accounts.", narration: "Invoices connect completed work to cash collection and QuickBooks accounting status." },
  { key: "commissions", name: "Commissions", route: "/commissions", role: ["owner"], target: "nav-commissions", summary: "Review salesperson commissions using the configured basis and rates.", narration: "Commission reporting makes compensation transparent and traceable to approved business results." },
  { key: "sales", name: "Sales Performance", route: "/sales", role: ownerSales, target: "nav-sales-performance", summary: "Compare sales activity, conversion, revenue, and team performance.", narration: "Sales performance shows where coaching, follow-up, or process changes can improve results." },
  { key: "customers", name: "Customers", route: "/customers", role: ownerSales, target: "nav-customers", summary: "See the full relationship across leads, jobs, proposals, invoices, and communication.", narration: "The customer record provides a complete history so the team does not have to reconstruct context from separate tools." },
  { key: "reports", name: "Reports", route: "/reports", role: ["owner"], target: "nav-reports", summary: "Analyze revenue, profit, flooring mix, crews, delays, and completed work.", narration: "Reports turn operational records into decisions about pricing, staffing, suppliers, and growth." },
  { key: "settings", name: "Settings", route: "/settings", role: ["owner"], target: "nav-settings", summary: "Configure the company, estimator, commissions, demo data, and QuickBooks.", narration: "Settings control the business rules and integrations that apply throughout Knox Operations." },
  { key: "integration-health", name: "Integration Health", route: "/integration-health", role: ownerOps, target: "nav-integration-health", summary: "Distinguish live, sandbox, simulated, disconnected, and error states.", narration: "Integration Health gives the owner an honest, supportable view of every connected service." },
  { key: "demo-outbox", name: "Demo Outbox", route: "/demo-outbox", role: ownerSales, target: "nav-demo-outbox", summary: "Review safely captured demonstration emails and text messages.", narration: "The Demo Outbox lets the team rehearse communications without contacting a real customer." },
];

export function findTrainingStep(stepId: string) {
  for (const mission of TRAINING_MISSIONS) {
    const step = mission.steps.find((candidate) => candidate.id === stepId);
    if (step) return { mission, step };
  }
  const guide = PAGE_GUIDES.find((candidate) => `guide-${candidate.key}` === stepId);
  return guide ? { guide, step: { id: stepId, narration: guide.narration } } : null;
}

export function canCompleteTrainingStep(step: Pick<TrainingStep, "kind">, targetInteracted: boolean, skipped = false) {
  return skipped || step.kind === "info" || targetInteracted;
}
