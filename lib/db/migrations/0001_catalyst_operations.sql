CREATE TABLE "crew_bookings" (
	"id" text PRIMARY KEY NOT NULL,
	"crew_id" text NOT NULL,
	"job_id" text NOT NULL,
	"start_at" text NOT NULL,
	"end_at" text NOT NULL,
	"planned_labor_hours" real NOT NULL,
	"status" text DEFAULT 'Confirmed' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crews" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"timezone" text DEFAULT 'America/New_York' NOT NULL,
	"size" integer,
	"daily_capacity_hours" real,
	"working_days" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"unavailable_dates" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_sites" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"address" text DEFAULT '' NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"state" text DEFAULT '' NOT NULL,
	"zip" text DEFAULT '' NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"merged_into_id" text,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "estimate_drafts" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_user_id" text NOT NULL,
	"title" text DEFAULT 'Untitled estimate' NOT NULL,
	"customer_id" text,
	"site_id" text,
	"lead_id" text,
	"inputs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"snapshot" jsonb,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"state" text DEFAULT 'Draft' NOT NULL,
	"converted_proposal_id" text,
	"converted_job_id" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_movements" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"job_id" text,
	"quantity" real NOT NULL,
	"kind" text NOT NULL,
	"reason" text NOT NULL,
	"actor_user_id" text,
	"idempotency_key" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_reservations" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"job_id" text NOT NULL,
	"quantity" real NOT NULL,
	"status" text DEFAULT 'Active' NOT NULL,
	"idempotency_key" text NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_callbacks" (
	"id" text PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'Open' NOT NULL,
	"assigned_to" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"resolved_at" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "customer_id" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "site_id" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "estimate_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "sold_at" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "completed_at" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "event_date_source" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "completion_checklist" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "customer_id" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "site_id" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "job_materials" ADD COLUMN "product_id" text;--> statement-breakpoint
ALTER TABLE "labor_entries" ADD COLUMN "crew_id" text;--> statement-breakpoint
ALTER TABLE "labor_entries" ADD COLUMN "booking_id" text;--> statement-breakpoint
ALTER TABLE "material_usage" ADD COLUMN "product_id" text;--> statement-breakpoint
ALTER TABLE "material_usage" ADD COLUMN "movement_id" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "coverage_per_unit" real;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "coverage_unit" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "order_multiple" real;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "minimum_order_qty" real;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "reorder_point" real;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "customer_id" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "site_id" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "estimate_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "customer_id" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "company_logo_url" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "customer_accent_color" text DEFAULT '#7B00F5' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "estimate_policy" jsonb;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "transition_policy" jsonb;--> statement-breakpoint
ALTER TABLE "crew_bookings" ADD CONSTRAINT "crew_bookings_crew_id_crews_id_fk" FOREIGN KEY ("crew_id") REFERENCES "public"."crews"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_sites" ADD CONSTRAINT "customer_sites_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "crew_bookings_crew_dates_idx" ON "crew_bookings" USING btree ("crew_id","start_at","end_at");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_movements_idempotency_unique" ON "inventory_movements" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "inventory_movements_product_idx" ON "inventory_movements" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_reservations_idempotency_unique" ON "inventory_reservations" USING btree ("idempotency_key");
--> statement-breakpoint
-- Preserve the stock count exactly; historical receipts and usage are not invented.
INSERT INTO "inventory_movements" ("id", "product_id", "quantity", "kind", "reason", "idempotency_key", "created_at")
SELECT 'opening:' || "id", "id", "quantity_on_hand", 'opening',
  'Opening balance preserved during Catalyst Works migration', 'opening:' || "id", to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
FROM "products"
ON CONFLICT ("idempotency_key") DO NOTHING;
--> statement-breakpoint
-- A square foot covers one square foot. Box, roll, piece and trim coverage needs review.
UPDATE "products" SET "coverage_per_unit" = 1, "coverage_unit" = 'sqft'
WHERE "unit" = 'sqft' AND "coverage_per_unit" IS NULL AND "coverage_unit" IS NULL;
