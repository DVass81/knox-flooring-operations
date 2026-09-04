export type JobStatus = 
  | 'New Lead'
  | 'Estimate Scheduled'
  | 'Estimate Completed'
  | 'Proposal Sent'
  | 'Approved'
  | 'Material Ordered'
  | 'Material Received'
  | 'Scheduled'
  | 'In Progress'
  | 'Final Walkthrough'
  | 'Completed'
  | 'Invoiced';

export type PriorityLevel = 'Low' | 'Medium' | 'High';
export type RiskLevel = 'Low' | 'Medium' | 'High';
export type CrewAssigned = 'Crew A' | 'Crew B' | 'Crew C' | 'Crew D' | 'Unassigned';

export type FlooringType = 
  | 'Carpet'
  | 'Hardwood'
  | 'Tile'
  | 'Laminate'
  | 'Luxury Vinyl Plank (LVP)'
  | 'Luxury Vinyl Tile (LVT)'
  | 'Waterproof Flooring'
  | 'Commercial Carpet Tile'
  | 'Commercial LVT';

export type MaterialStatusBadge = 
  | 'Ordered'
  | 'In Transit'
  | 'Received'
  | 'Delayed'
  | 'Damaged'
  | 'Missing Items';

export interface Room {
  id: string;
  name: string;
  length: number;
  width: number;
  scope?: string;
}

export interface JobMaterial {
  id: string;
  jobId: string;
  name: string;
  quantity: number;
  unit: string;
  createdAt: string;
}

export interface LaborEntry {
  id: string;
  jobId: string;
  date: string;
  crew: string;
  hours: number;
  notes: string;
  createdAt: string;
}

export interface MaterialUsage {
  id: string;
  jobId: string;
  material: string;
  quantity: number;
  cost: number;
  notes: string;
  createdAt: string;
}

export interface StageEvent {
  stage: JobStatus;
  at: string;
}

export interface JobPhoto {
  id: string;
  jobId: string;
  stage: JobStatus;
  objectPath: string;
  caption: string;
  createdAt: string;
}

export interface Job {
  id: string;
  jobNumber: string;
  customerName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  flooringType: FlooringType;
  rooms: Room[];
  scopeOfWork: string;
  squareFootage: number;
  crewAssigned: CrewAssigned;
  salespersonId?: string | null;
  estStartDate?: string;
  estCompletionDate?: string;
  materialStatus: MaterialStatusBadge;
  laborEstimate: number;
  estLaborHours: number;
  materialEstimate: number;
  estRevenue: number;
  estGrossProfit: number;
  grossMarginPct: number;
  actualRevenue: number;
  actualLaborCost: number;
  actualMaterialCost: number;
  actualAddOnCost: number;
  notes: string;
  priorityLevel: PriorityLevel;
  riskLevel: RiskLevel;
  status: JobStatus;
  stageHistory: StageEvent[];
  shareToken: string;
  createdAt: string;
  updatedAt: string;
}

export interface MaterialRecord {
  id: string;
  jobId: string;
  jobNumber: string;
  customer: string;
  city: string;
  flooringType: FlooringType;
  supplier: string;
  orderedDate?: string;
  expectedDeliveryDate?: string;
  actualDeliveryDate?: string;
  received: boolean;
  damaged: boolean;
  missingItems: string;
  notes: string;
  status: MaterialStatusBadge;
}

export type DepositType = 'none' | 'percent' | 'amount';
export type ProposalStatus = 'Draft' | 'Sent' | 'Viewed' | 'Accepted' | 'Declined' | 'Expired';

export interface ProposalLineItem {
  id: string;
  productId?: string;
  name: string;
  category?: string;
  sku?: string;
  unit: string;
  quantity: number;
  unitPrice: number;
}

export interface Proposal {
  id: string;
  jobId?: string;
  customerName: string;
  projectLocation: string;
  flooringType: FlooringType;
  roomList: Room[];
  lineItems: ProposalLineItem[];
  salespersonId?: string | null;
  totalSqFt: number;
  scopeOfWork: string;
  estimatedPrice: number;
  expectedTimeline: string;
  materialAssumptions: string;
  exclusions: string;
  warrantyNote: string;
  depositType: DepositType;
  depositValue: number;
  paymentTerms: string;
  status: ProposalStatus;
  shareToken: string;
  sentAt?: string;
  viewedAt?: string;
  acceptedAt?: string;
  declinedAt?: string;
  signature: string;
  convertedJobId?: string | null;
  convertedInvoiceId?: string | null;
  createdAt: string;
}

export type InvoiceStatus = 'Draft' | 'Sent' | 'Partial' | 'Paid' | 'Overdue' | 'Credited' | 'Refunded' | 'Voided';
export type InvoiceLineCategory = 'Labor' | 'Materials' | 'Add-on';

export interface InvoiceLineItem {
  id: string;
  description: string;
  category: InvoiceLineCategory;
  quantity: number;
  unitPrice: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  jobId: string;
  jobNumber: string;
  customerName: string;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  taxableAmount: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  depositAmount: number;
  paidAmount: number;
  balanceAmount: number;
  refundedAmount: number;
  taxCode: string;
  paymentReference: string;
  paidAt?: string;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type ProductCategory =
  | 'Vinyl Plank'
  | 'Vinyl Tile'
  | 'Carpet'
  | 'Hardwood'
  | 'Tile'
  | 'Laminate'
  | 'Waterproof'
  | 'Commercial'
  | 'Trim/Supplies'
  | 'Padding'
  | 'Underlayment'
  | 'Trim'
  | 'Installation';

export type ProductUnit = 'sqft' | 'box' | 'lineal ft' | 'each' | 'piece';

export type ProductInventoryType = 'Inventory' | 'Special Order' | 'Service';

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  sku: string;
  supplier: string;
  color: string;
  unit: ProductUnit;
  cost: number;
  price: number;
  quantityOnHand: number;
  inventoryType: ProductInventoryType;
  active: boolean;
  notes: string;
  imageUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Lead stages are user-configurable (see Settings.leadStages), so the stage is a
 * free string. "Won" and "Lost" are reserved terminal stages with special handling.
 */
export type LeadStage = string;

export const WON_STAGE = 'Won';
export const LOST_STAGE = 'Lost';

export type LeadSource =
  | 'Referral'
  | 'Website'
  | 'Walk-in'
  | 'Phone Call'
  | 'Social Media'
  | 'Home Show'
  | 'Repeat Customer'
  | 'Google'
  | 'Other';

export type LeadActivityType = 'Note' | 'Call' | 'Email' | 'Stage Change' | 'Follow-up';

export interface LeadActivity {
  id: string;
  date: string;
  type: LeadActivityType;
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

export type MeasurementSyncStatus = "local" | "pending" | "synced" | "error";

export interface MeasurementRoom {
  name: string;
  sqft: number;
  lengthFt?: number;
  widthFt?: number;
  product?: string;
}

export interface MeasurementProduct {
  name: string;
  sku?: string;
  quantity?: number;
  unit?: string;
  sqft?: number;
}

export interface Measurement {
  id: string;
  leadId?: string | null;
  jobId?: string | null;
  externalId?: string | null;
  label: string;
  rooms: MeasurementRoom[];
  products: MeasurementProduct[];
  totalSqft: number;
  total: number;
  measuredDate?: string | null;
  source: string;
  syncStatus: MeasurementSyncStatus;
  syncError?: string | null;
  lastSyncedAt?: string | null;
  isDemo: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface MeasureSquareStatus {
  connected: boolean;
  configured: boolean;
  message: string;
  lastSyncedAt?: string | null;
}

export interface SyncMeasurementsResult {
  connected: boolean;
  configured: boolean;
  pulled: number;
  pushed: number;
  errors: string[];
  message: string;
  syncedAt?: string | null;
}

export interface Lead {
  id: string;
  customerName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  flooringInterest: FlooringType;
  estimatedValue: number;
  source: LeadSource;
  stage: LeadStage;
  salesperson: string;
  followUpDate?: string | null;
  company?: string;
  contactType?: string;
  branch?: string;
  mainPhone?: string;
  spousePhone?: string;
  ccEmail?: string;
  desiredServices?: string;
  estimatedSqft?: number;
  interestLevel?: string;
  installRequest?: string;
  leadCost?: number;
  financingAmount?: number;
  taxExempt?: boolean;
  addressTitle?: string;
  street?: string;
  state?: string;
  zip?: string;
  county?: string;
  subdivision?: string;
  sortOrder?: number;
  activityLog: LeadActivity[];
  noteEntries?: LeadNote[];
  contacts?: LeadContact[];
  addresses?: LeadAddress[];
  samples?: LeadSample[];
  tasks?: LeadTask[];
  interactions?: LeadInteraction[];
  documents?: LeadDocument[];
  measurements?: LeadMeasurement[];
  notes: string;
  lostReason?: string | null;
  convertedJobId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Salesperson {
  id: string;
  name: string;
  email: string;
  phone: string;
  active: boolean;
  /** Per-rep commission rate override (percent). Null = use global default. */
  commissionRate?: number | null;
  /** Hex color used to identify this rep on the task calendar. */
  color?: string | null;
  createdAt: string;
}

export type TaskStatus = 'Open' | 'Done';

export interface Task {
  id: string;
  title: string;
  description: string;
  assigneeId?: string | null;
  startAt: string;
  endAt: string;
  allDay: boolean;
  status: TaskStatus;
  relatedLeadId?: string | null;
  relatedJobId?: string | null;
  googleEventId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CommunicationChannel = 'email' | 'sms';
export type CommunicationDirection = 'outbound' | 'inbound';
export type CommunicationStatus =
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'received';

export interface Communication {
  id: string;
  leadId?: string | null;
  customerKey?: string | null;
  customerName?: string;
  channel: CommunicationChannel;
  direction: CommunicationDirection;
  toAddress: string;
  fromAddress: string;
  subject: string;
  body: string;
  status: CommunicationStatus;
  providerMessageId?: string | null;
  errorMessage?: string | null;
  createdAt: string;
}

export type CommissionBasis = 'Revenue' | 'Gross Profit';

export interface Settings {
  ownerName: string;
  ownerRole: string;
  companyName: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  defaultWasteFactor: number;
  defaultLaborRateLVP: number;
  defaultLaborRateHardwood: number;
  defaultLaborRateCarpet: number;
  defaultLaborRateTile: number;
  commissionBasis: CommissionBasis;
  defaultCommissionRate: number;
  leadStages?: string[];
  googleCalendarSyncToken?: string | null;
  googleCalendarLastSyncedAt?: string | null;
}
