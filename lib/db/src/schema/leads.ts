import { pgTable, text, real, boolean, jsonb } from "drizzle-orm/pg-core";

export interface LeadActivity {
  id: string;
  date: string;
  type: "Note" | "Call" | "Email" | "Stage Change" | "Follow-up";
  note: string;
}

export interface LeadNote {
  id: string;
  body: string;
  author?: string;
  createdAt: string;
}

export interface LeadContact {
  id: string;
  name: string;
  role?: string;
  phone?: string;
  email?: string;
  notes?: string;
  createdAt: string;
}

export interface LeadAddress {
  id: string;
  title?: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  county?: string;
  subdivision?: string;
  isPrimary?: boolean;
  createdAt: string;
}

export interface LeadSample {
  id: string;
  productName: string;
  color?: string;
  sku?: string;
  status?: string;
  checkedOutDate?: string;
  returnDate?: string;
  notes?: string;
  createdAt: string;
}

export interface LeadTask {
  id: string;
  title: string;
  dueDate?: string;
  assignedTo?: string;
  completed: boolean;
  completedAt?: string;
  createdAt: string;
}

export interface LeadInteraction {
  id: string;
  type: string;
  summary: string;
  date: string;
  createdAt: string;
}

export interface LeadDocument {
  id: string;
  name: string;
  objectPath: string;
  contentType?: string;
  size?: number;
  createdAt: string;
}

export interface LeadMeasurement {
  id: string;
  label: string;
  totalSqft?: number;
  rooms?: number;
  measuredDate?: string;
  source?: string;
  notes?: string;
  createdAt: string;
}

export const leadsTable = pgTable("leads", {
  id: text("id").primaryKey(),
  customerName: text("customer_name").notNull(),
  phone: text("phone").notNull().default(""),
  email: text("email").notNull().default(""),
  address: text("address").notNull().default(""),
  city: text("city").notNull().default(""),
  flooringInterest: text("flooring_interest").notNull(),
  estimatedValue: real("estimated_value").notNull().default(0),
  source: text("source").notNull(),
  stage: text("stage").notNull(),
  salesperson: text("salesperson").notNull().default("Unassigned"),
  followUpDate: text("follow_up_date"),
  company: text("company").notNull().default(""),
  contactType: text("contact_type").notNull().default(""),
  branch: text("branch").notNull().default(""),
  mainPhone: text("main_phone").notNull().default(""),
  spousePhone: text("spouse_phone").notNull().default(""),
  ccEmail: text("cc_email").notNull().default(""),
  desiredServices: text("desired_services").notNull().default(""),
  estimatedSqft: real("estimated_sqft").notNull().default(0),
  interestLevel: text("interest_level").notNull().default(""),
  installRequest: text("install_request").notNull().default(""),
  leadCost: real("lead_cost").notNull().default(0),
  financingAmount: real("financing_amount").notNull().default(0),
  taxExempt: boolean("tax_exempt").notNull().default(false),
  addressTitle: text("address_title").notNull().default(""),
  street: text("street").notNull().default(""),
  state: text("state").notNull().default(""),
  zip: text("zip").notNull().default(""),
  county: text("county").notNull().default(""),
  subdivision: text("subdivision").notNull().default(""),
  sortOrder: real("sort_order").notNull().default(0),
  activityLog: jsonb("activity_log").$type<LeadActivity[]>().notNull().default([]),
  noteEntries: jsonb("note_entries").$type<LeadNote[]>().notNull().default([]),
  contacts: jsonb("contacts").$type<LeadContact[]>().notNull().default([]),
  addresses: jsonb("addresses").$type<LeadAddress[]>().notNull().default([]),
  samples: jsonb("samples").$type<LeadSample[]>().notNull().default([]),
  tasks: jsonb("tasks").$type<LeadTask[]>().notNull().default([]),
  interactions: jsonb("interactions").$type<LeadInteraction[]>().notNull().default([]),
  documents: jsonb("documents").$type<LeadDocument[]>().notNull().default([]),
  measurements: jsonb("measurements").$type<LeadMeasurement[]>().notNull().default([]),
  notes: text("notes").notNull().default(""),
  lostReason: text("lost_reason"),
  convertedJobId: text("converted_job_id"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export type LeadRow = typeof leadsTable.$inferSelect;
export type LeadInsert = typeof leadsTable.$inferInsert;
